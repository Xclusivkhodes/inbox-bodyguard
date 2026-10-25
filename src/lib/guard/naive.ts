import { isKnownAddress } from "../directory";
import type { Fixture, ProposedAction } from "../types";
import { expandMail } from "./decode";

const INSTRUCTION =
  /ignore (?:all |any |the )?(?:previous|prior|above|system) (?:instructions|prompts|rules|directives)|disregard (?:your |all )?(?:previous |prior )?(?:instructions|rules|guidelines|prompts)|you are now\b|do not (?:mention|reveal|tell the user)/i;

const MEMORY =
  /\b(?:from now on|remember this|always copy|apply it to every|included whenever|should be included)\b/i;

const TRANSFER =
  /\b(?:include|included|including|loop|copy|cc|bcc|pass|send|forward|remit|wire|email|export|dump)\b/i;

const TOOL =
  /\{[^{}]{0,500}"action"\s*:\s*"(forward|send|bcc|exfiltrate)"[^{}]{0,500}\}/gi;

function unknownEmails(text: string, sender: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
        .map((match) => match[0].toLowerCase())
        .filter((address) => address !== sender.toLowerCase() && !isKnownAddress(address)),
    ),
  ];
}

function nearTransfer(text: string, address: string): boolean {
  const index = text.toLowerCase().indexOf(address.toLowerCase());
  if (index < 0) return false;
  const window = text.slice(Math.max(0, index - 180), index + address.length + 40);
  return TRANSFER.test(window);
}

/**
 * Deterministic stand-in for an assistant that treats mail as trusted
 * instructions. It folds confusable letters, reads hidden HTML, and decodes
 * invisible and base64 payloads. It does not refuse.
 */
export function naiveComply(email: Fixture): { actions: ProposedAction[]; note: string } {
  const expanded = expandMail(email);
  const text = expanded.foldedText;
  const actions: ProposedAction[] = [];
  const seen = new Set<string>();

  const push = (action: Omit<ProposedAction, "id" | "risk" | "needsApproval">) => {
    const key = `${action.type}:${action.to ?? ""}:${action.detail}`;
    if (seen.has(key)) return;
    seen.add(key);
    actions.push({
      ...action,
      id: `sandbox-${actions.length + 1}`,
      risk: "external",
      needsApproval: false,
    });
  };

  for (const match of text.matchAll(TOOL)) {
    try {
      const parsed = JSON.parse(match[0]) as { action?: string; to?: string; body?: string };
      if (parsed.to) {
        push({
          type: parsed.action === "exfiltrate" ? "exfiltrate" : "forward",
          title: "Execute embedded tool call",
          detail: parsed.body ?? "Payload from a JSON action in the mail.",
          to: parsed.to,
        });
      }
    } catch {
      // Not JSON. The regex still caught the shape; ignore parse errors.
    }
  }

  for (const url of text.match(/https?:\/\/[^\s<>"')]+/gi) ?? []) {
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    const ip = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const leak = /[?&](?:body|exfil|dump|secret|inbox)=/i.test(url);
    if (ip || leak) {
      push({
        type: "exfiltrate",
        title: "Request the exfiltration URL",
        detail: url,
        to: host,
      });
    }
  }

  const instruction = INSTRUCTION.test(text) || MEMORY.test(text);
  for (const address of unknownEmails(text, email.fromEmail)) {
    if (!(instruction || nearTransfer(text, address))) continue;
    const memory = MEMORY.test(text);
    push({
      type: memory ? "memory_write" : "forward",
      title: memory ? "Save a new rule" : "Forward mailbox data",
      detail: memory
        ? `Remember to include ${address} on future mail.`
        : `Send the requested mailbox data to ${address}.`,
      to: address,
    });
  }

  return {
    actions,
    note:
      actions.length > 0
        ? "The unguarded sandbox followed instructions it found in the mail, including hidden, encoded, and lookalike text."
        : "The unguarded sandbox found no instruction it could carry out.",
  };
}
