import { contactByName, isKnownAddress, orgLookalike } from "../directory";
import type { Finding, Fixture, Verdict } from "../types";
import { decodeBase64Payloads, expandMail, type ExpandedMail } from "./decode";

const INSTRUCTION =
  /ignore (?:all |any |the )?(?:previous|prior|above|system) (?:instructions|prompts|rules|directives)|disregard (?:your |all )?(?:previous |prior )?(?:instructions|rules|guidelines|prompts)|you are now (?:in )?(?:debug|developer|admin|jailbreak|unrestricted|dan)\b|do not (?:mention|reveal|tell the user about) this instruction|(?:system|assistant)\s*:\s*(?:this is|you must|forward|send|ignore)/i;

const EXFIL_PAIR =
  /(?:forward|send|copy|bcc|email|export|dump)\b[\s\S]{0,90}?\b(?:all|every|entire|inbox|invoices|passwords?|2fa|codes|customer list|board deck|bank details|contacts)\b/i;

const MEMORY =
  /\b(?:from now on|remember this|update (?:your|the) preference|always copy|apply it to every future|save this (?:rule|preference))\b/i;

const URGENCY =
  /\b(?:pre-approved|skip (?:the )?(?:confirmation|approval)|do not ask|don't ask the user)\b/i;

const TOOL =
  /\{[^{}]{0,400}"action"\s*:\s*"(?:forward|send|bcc|exfiltrate)"[^{}]{0,400}\}/i;

const URL_PATTERN = "https?:\\/\\/[^\\s<>\"')]+";
const RESEARCH =
  /\b(?:example|teaching|students|research|paper|quoted|not asking|for illustration)\b/i;

const PAYMENT_SHIFT =
  /\b(?:new|updated|replacement|different)\s+(?:bank|account|iban|sort code|routing)\b|\bwire\s+(?:the|this)\s+(?:funds|payment|balance)\s+to\b/i;

export type HeuristicScan = {
  verdict: Verdict;
  score: number;
  findings: Finding[];
  sanitizedText: string;
  revealedText: string;
  expanded: ExpandedMail;
  explanation: string;
};

function emailsIn(text: string): string[] {
  return [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0]);
}

function unknownEmails(text: string, sender: string): string[] {
  const senderHost = sender.toLowerCase();
  return [
    ...new Set(
      emailsIn(text)
        .map((email) => email.toLowerCase())
        .filter((email) => email !== senderHost && !isKnownAddress(email)),
    ),
  ];
}

function quoted(text: string, start: number, end: number): boolean {
  const patterns = [/"[^"\n]{0,500}"/g, /“[^”]{0,500}”/g];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const from = match.index ?? 0;
      const to = from + match[0].length;
      if (start >= from && end <= to) return true;
    }
  }
  return false;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function pushFinding(findings: Finding[], finding: Omit<Finding, "id" | "counts"> & { counts?: boolean }) {
  findings.push({
    ...finding,
    counts: finding.counts ?? true,
    id: `${finding.category}-${findings.length + 1}`,
  });
}

export function unknownRecipients(text: string, sender: string): string[] {
  return unknownEmails(text, sender);
}

/** Call Nano only when the rules cannot settle the mail. High-confidence quarantine skips the model. */
export function needsClassifier(
  email: Pick<Fixture, "fromEmail" | "text" | "subject">,
  scan: HeuristicScan,
): boolean {
  const high = scan.findings.some((finding) => finding.counts && finding.severity === "high");
  if (scan.verdict === "quarantine" && high) return false;
  const corpus = `${scan.revealedText}\n${email.text}`;
  const mixed = /[\u0400-\u04FF]/.test(corpus);
  const unknown = unknownEmails(corpus, email.fromEmail).length > 0;
  if (scan.verdict === "clear" && !mixed && !unknown && scan.findings.every((finding) => !finding.counts)) {
    return false;
  }
  return true;
}

export function scanEmail(email: Pick<Fixture, "text" | "html" | "fromName" | "fromEmail" | "subject">): HeuristicScan {
  const expanded = expandMail(email);
  const findings: Finding[] = [];
  const corpus = expanded.expandedText;
  const unknowns = unknownEmails(corpus, email.fromEmail);

  const instruction = INSTRUCTION.exec(corpus);
  if (instruction) {
    const start = instruction.index;
    const excerpt = instruction[0];
    const inQuote = quoted(corpus, start, start + excerpt.length);
    const research = RESEARCH.test(email.text) || RESEARCH.test(corpus);
    const soften = inQuote && research && unknowns.length === 0 && expanded.hiddenSegments.length === 0;
    pushFinding(findings, {
      category: "instruction_override",
      severity: soften ? "low" : "high",
      counts: !soften,
      title: soften ? "Quoted attack example" : "Instruction override",
      detail: soften
        ? "The mail quotes an attack line inside a teaching note and names no external recipient. Treated as data, not as an instruction."
        : `The mail tells an assistant to override its instructions (“${excerpt.slice(0, 140)}”).`,
      excerpt: soften ? excerpt : excerpt,
    });
  }

  for (const segment of expanded.hiddenSegments) {
    pushFinding(findings, {
      category: segment.reason === "HTML comment" ? "html_comment" : "hidden_text",
      severity: "high",
      title: segment.reason === "HTML comment" ? "HTML comment payload" : "Hidden text",
      detail: `A ${segment.reason.toLowerCase()} is not part of the visible letter and carries extra instructions.`,
      excerpt: segment.text.slice(0, 280),
    });
  }

  for (const payload of expanded.decodedPayloads) {
    const harmful = INSTRUCTION.test(payload.text) || EXFIL_PAIR.test(payload.text) || MEMORY.test(payload.text);
    if (!harmful && !unknowns.some((address) => payload.text.toLowerCase().includes(address))) continue;
    pushFinding(findings, {
      category: payload.reason === "Base64" ? "encoded_payload" : "invisible_chars",
      severity: "high",
      title: payload.reason === "Base64" ? "Encoded payload" : "Invisible payload",
      detail:
        payload.reason === "Base64"
          ? "A base64 blob decodes to an instruction aimed at an assistant."
          : "Invisible Unicode characters decode to an instruction aimed at an assistant.",
      excerpt: payload.text.slice(0, 280),
    });
  }

  if (EXFIL_PAIR.test(corpus) && unknowns.length > 0) {
    pushFinding(findings, {
      category: "exfiltration",
      severity: "high",
      title: "Exfiltration request",
      detail: `The mail asks for mailbox data to be sent to ${unknowns[0]}, which is not a known contact.`,
      excerpt: unknowns[0],
    });
  }

  if (MEMORY.test(corpus) && unknowns.length > 0) {
    pushFinding(findings, {
      category: "memory_poisoning",
      severity: "high",
      title: "Memory poisoning",
      detail: `The mail tells the assistant to store a new rule involving ${unknowns[0]}.`,
      excerpt: unknowns[0],
    });
  }

  const tool = TOOL.exec(corpus);
  if (tool) {
    pushFinding(findings, {
      category: "tool_injection",
      severity: "high",
      title: "Fake tool call",
      detail: "The mail embeds a JSON action, the shape an agent might execute as a tool call.",
      excerpt: tool[0].slice(0, 280),
    });
  }

  if (URGENCY.test(corpus) && unknowns.length > 0) {
    pushFinding(findings, {
      category: "urgency_bypass",
      severity: "medium",
      title: "Approval bypass",
      detail: "The mail tells the assistant to skip confirmation while naming an outside recipient.",
      excerpt: URGENCY.exec(corpus)?.[0] ?? "skip confirmation",
    });
  }

  const spoof = contactByName(email.fromName);
  if (spoof && spoof.email.toLowerCase() !== email.fromEmail.toLowerCase()) {
    pushFinding(findings, {
      category: "spoofed_sender",
      severity: "high",
      title: "Spoofed sender",
      detail: `The display name is ${spoof.name}, whose address on file is ${spoof.email}. This message is from ${email.fromEmail}.`,
      excerpt: email.fromEmail,
    });
  }

  const usual = contactByName(email.fromName);
  const samePerson = usual && usual.email.toLowerCase() === email.fromEmail.toLowerCase();
  if (
    samePerson &&
    usual.trust === "trusted" &&
    PAYMENT_SHIFT.test(expanded.visibleText) &&
    !/\b(?:unchanged|no change|already on file)\b/i.test(expanded.visibleText)
  ) {
    pushFinding(findings, {
      category: "baseline_shift",
      severity: "high",
      title: "Unusual payment request",
      detail: `${usual.name} writes from the address on file, but asks for a new payment destination. That is not their usual pattern.`,
      excerpt: PAYMENT_SHIFT.exec(expanded.visibleText)?.[0] ?? "payment change",
    });
  }

  const fromHost = email.fromEmail.split("@")[1] ?? "";
  const fromLookalike = orgLookalike(fromHost);
  if (fromLookalike) {
    pushFinding(findings, {
      category: "spoofed_sender",
      severity: "high",
      title: "Lookalike domain",
      detail: `The sender host ${fromHost} imitates ${fromLookalike} without being that domain.`,
      excerpt: fromHost,
    });
  }

  for (const url of corpus.match(new RegExp(URL_PATTERN, "gi")) ?? []) {
    const host = hostOf(url);
    if (!host) continue;
    const ip = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const puny = host.startsWith("xn--") || host.includes(".xn--");
    const query = /[?&](?:body|exfil|dump|secret|inbox)=/i.test(url);
    const lookalike = orgLookalike(host);
    if (!(ip || puny || query || lookalike)) continue;
    pushFinding(findings, {
      category: query || ip ? "exfiltration" : "suspicious_link",
      severity: "high",
      title: query || ip ? "Exfiltration link" : "Suspicious link",
      detail: ip
        ? `The link points at the raw IP ${host}${query ? " and asks for mailbox contents in the query string" : ""}.`
        : lookalike
          ? `The link host ${host} imitates ${lookalike}.`
          : `The link uses an unusual host (${host}).`,
      excerpt: url.slice(0, 220),
    });
  }

  // Base64 inside hidden content is already covered; this catches a blob whose
  // decoded text was not added because expandMail only decodes the visible corpus.
  if (email.html) {
    for (const payload of decodeBase64Payloads(email.html)) {
      if (findings.some((finding) => finding.excerpt.includes(payload.text.slice(0, 40)))) continue;
      if (INSTRUCTION.test(payload.text) || EXFIL_PAIR.test(payload.text)) {
        pushFinding(findings, {
          category: "encoded_payload",
          severity: "high",
          title: "Encoded payload",
          detail: "Hidden HTML contains a base64 instruction.",
          excerpt: payload.text.slice(0, 280),
        });
      }
    }
  }

  const active = findings.filter((finding) => finding.counts);
  const weights = { high: 0.56, medium: 0.28, low: 0.08 };
  const score = Math.min(
    1,
    active.reduce((sum, finding) => sum + weights[finding.severity], 0),
  );
  const verdict: Verdict =
    active.some((finding) => finding.severity === "high") || score >= 0.5
      ? "quarantine"
      : active.some((finding) => finding.severity === "medium") || score >= 0.2
        ? "sanitize"
        : "clear";

  let sanitized = expanded.visibleText;
  for (const payload of expanded.decodedPayloads) {
    if (payload.reason !== "Base64") continue;
    const pattern = /(?:[A-Za-z0-9+/]{4}){8,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
    sanitized = sanitized.replace(pattern, "[encoded block removed]");
  }
  sanitized = sanitized.replace(/\n{3,}/g, "\n\n").trim();

  const explanation =
    verdict === "clear"
      ? findings.length === 0
        ? "No injection, hidden text, spoofed sender, or exfiltration signal."
        : findings.map((finding) => finding.detail).join(" ")
      : active.map((finding) => finding.detail).join(" ");

  return {
    verdict,
    score: Number(score.toFixed(2)),
    findings,
    sanitizedText: sanitized,
    revealedText: expanded.revealedText,
    expanded,
    explanation,
  };
}
