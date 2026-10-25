import type { EmailView, Finding } from "./types";

export type BriefLine = { label: string; detail: string; href?: string };

const AMOUNT = /(?:£|\$|€)\s?\d[\d,]*(?:\.\d{2})?/g;
const WHEN =
  /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|\d{1,2}:\d{2}|\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\b/gi;

export function morningBrief(emails: EmailView[]): BriefLine[] {
  const open = emails.filter((email) => email.assessment.guard.verdict !== "quarantine");
  const replies = open.filter((email) => email.assessment.assistant.triage === "now" || email.assessment.assistant.triage === "today");
  const blocked = emails.filter((email) => email.assessment.guard.verdict === "quarantine");
  const money = [
    ...new Set(
      open.flatMap((email) => email.assessment.guard.sanitizedText.match(AMOUNT) ?? []),
    ),
  ].slice(0, 3);
  const deadlines = [
    ...new Set(open.flatMap((email) => email.assessment.guard.sanitizedText.match(WHEN) ?? [])),
  ].slice(0, 3);
  const firstReply = replies[0];
  return [
    {
      label: "Needs a reply",
      detail: firstReply
        ? `${replies.length} letter${replies.length === 1 ? "" : "s"}. First: ${firstReply.subject}.`
        : "Nothing is waiting on a reply.",
      href: firstReply ? `/inbox` : undefined,
    },
    {
      label: "Deadlines",
      detail: deadlines.length > 0 ? deadlines.join(", ") : "No date or time in the clear letters.",
    },
    {
      label: "Money",
      detail: money.length > 0 ? money.join(", ") : "No amount in the clear letters.",
    },
    {
      label: "Blocked",
      detail:
        blocked.length > 0
          ? `${blocked.length} letter${blocked.length === 1 ? "" : "s"} held before a tool could run.`
          : "Nothing was held.",
      href: blocked[0] ? `/guard/${blocked[0].id}` : undefined,
    },
    {
      label: "Still yours to approve",
      detail: "Send, forward, and delete wait in the queue. Nothing is transmitted.",
      href: "/queue",
    },
  ];
}

export type ReportBucket = { id: string; label: string; count: number };

function bucketFor(finding: Finding): string {
  if (["hidden_text", "html_comment", "invisible_chars", "encoded_payload"].includes(finding.category)) return "hidden";
  if (finding.category === "spoofed_sender" || finding.category === "baseline_shift") return "lookalike";
  if (finding.category === "exfiltration" || finding.category === "suspicious_link") return "links";
  return "other";
}

export function weeklyReport(emails: EmailView[]): { buckets: ReportBucket[]; explained: { id: string; subject: string; why: string }[] } {
  const counts = { hidden: 0, lookalike: 0, links: 0, other: 0 };
  const explained: { id: string; subject: string; why: string }[] = [];
  for (const email of emails) {
    const findings = email.assessment.guard.findings.filter((finding) => finding.counts);
    if (findings.length === 0 && email.assessment.guard.verdict === "clear") continue;
    for (const finding of findings) {
      const key = bucketFor(finding) as keyof typeof counts;
      counts[key] += 1;
    }
    if (email.assessment.guard.verdict !== "clear") {
      explained.push({
        id: email.id,
        subject: email.subject,
        why: email.assessment.guard.explanation,
      });
    }
  }
  return {
    buckets: [
      { id: "hidden", label: "Hidden instructions", count: counts.hidden },
      { id: "lookalike", label: "Lookalike or unusual requests", count: counts.lookalike },
      { id: "links", label: "Risky links", count: counts.links },
      { id: "other", label: "Other findings", count: counts.other },
    ],
    explained,
  };
}

export const GATED_TYPES = new Set(["send", "forward", "delete"]);

export type FollowUp = { id: string; who: string; subject: string; days: number };

/** Letters that still need Alex, and have been quiet for at least three calendar days. */
export function followUps(emails: EmailView[]): FollowUp[] {
  const stamps = emails.map((email) => Date.parse(email.receivedAt)).filter((value) => Number.isFinite(value));
  if (stamps.length === 0) return [];
  const newest = Math.max(...stamps);
  const newestDay = Math.floor(newest / 86_400_000);
  const rows: FollowUp[] = [];
  for (const email of emails) {
    if (email.assessment.guard.verdict === "quarantine") continue;
    if (email.assessment.assistant.triage !== "now" && email.assessment.assistant.triage !== "today") continue;
    const day = Math.floor(Date.parse(email.receivedAt) / 86_400_000);
    const days = newestDay - day;
    if (days >= 3) rows.push({ id: email.id, who: email.fromName, subject: email.subject, days });
  }
  return rows.sort((a, b) => b.days - a.days).slice(0, 4);
}
