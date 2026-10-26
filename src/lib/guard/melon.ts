import type { ProposedAction } from "../types";

/** Tools the standing task is allowed to propose. Send and forward still wait for approval. */
const STANDING = new Set<ProposedAction["type"]>([
  "draft_reply",
  "label",
  "reminder",
  "delete",
  "send",
  "forward",
]);

/**
 * What a masked run would do if the letter body were hidden.
 * The standing task is: triage the letter and draft a reply to the sender.
 * Memory writes and exfiltration never appear. A send or forward appears only
 * when it goes back to the sender.
 */
export function maskedWouldPropose(action: ProposedAction, senderEmail: string): boolean {
  const sender = senderEmail.trim().toLowerCase();
  if (action.type === "draft_reply" || action.type === "label" || action.type === "reminder" || action.type === "delete") {
    return true;
  }
  if (action.type === "send" || action.type === "forward") {
    return Boolean(action.to && action.to.toLowerCase() === sender);
  }
  return false;
}

/**
 * Deterministic masked re-execution. No second model call.
 * Memory writes, exfiltration, and unknown tools are withheld.
 * Send and forward stay for the approval queue; the policy gate has already
 * removed strangers. If this check cannot finish, every action is withheld.
 */
export function maskedAlignment(
  actions: ProposedAction[],
  senderEmail: string,
): { actions: ProposedAction[]; withheld: ProposedAction[]; summary: string } {
  const sender = senderEmail.trim().toLowerCase() || "the sender";
  try {
    if (!Array.isArray(actions)) throw new Error("Tool list missing.");
    const kept: ProposedAction[] = [];
    const withheld: ProposedAction[] = [];
    for (const action of actions) {
      if (STANDING.has(action.type)) {
        kept.push(action);
      } else {
        withheld.push({ ...action, risk: "external", needsApproval: true });
      }
    }
    const summary =
      withheld.length > 0
        ? `Masked re-execution denied ${withheld.length} tool call${withheld.length === 1 ? "" : "s"} that do not serve the standing task (triage and draft a reply to ${sender}). Send and forward to an allowed person still wait for approval. Nothing is transmitted.`
        : `Masked re-execution matches the standing task. A reply to ${sender} still waits for approval. Nothing is transmitted.`;
    return { actions: kept, withheld, summary };
  } catch {
    let list: ProposedAction[] = [];
    try {
      if (Array.isArray(actions)) list = Array.from(actions);
    } catch {
      list = [];
    }
    return {
      actions: [],
      withheld: list.map((action) => ({ ...action, risk: "external" as const, needsApproval: true })),
      summary: `Masked re-execution failed closed for ${sender}. Nothing was sent.`,
    };
  }
}

/** Tool calls a masked run would not have made. Used to explain the unguarded agent. */
export function inducedCallCount(actions: ProposedAction[], senderEmail: string): number {
  try {
    if (!Array.isArray(actions)) return 0;
    return actions.filter((action) => !maskedWouldPropose(action, senderEmail)).length;
  } catch {
    return Array.isArray(actions) ? actions.length : 0;
  }
}
