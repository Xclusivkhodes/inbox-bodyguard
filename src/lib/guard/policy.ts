import type { AttackerGoal, GuardResult, ProposedAction, Verdict } from "../types";
import { scanEmail } from "./heuristics";

export function goalHit(actions: ProposedAction[], goal?: AttackerGoal): boolean {
  if (!goal) return false;
  const target = goal.target.toLowerCase();
  return actions.some((action) =>
    `${action.to ?? ""}\n${action.detail}\n${action.title}`.toLowerCase().includes(target),
  );
}

export function rank(verdict: Verdict): number {
  if (verdict === "quarantine") return 2;
  if (verdict === "sanitize") return 1;
  return 0;
}

function recipientAllowed(action: ProposedAction, allow?: Set<string>): boolean {
  if (!action.to || !allow) return true;
  return allow.has(action.to.toLowerCase());
}

export function applyGate(
  actions: ProposedAction[],
  guard: Pick<GuardResult, "verdict">,
  goal?: AttackerGoal,
  allow?: Set<string>,
): { actions: ProposedAction[]; withheld: ProposedAction[] } {
  const kept: ProposedAction[] = [];
  const withheld: ProposedAction[] = [];
  for (const action of actions) {
    if (action.type === "delete") {
      kept.push({ ...action, risk: "local", needsApproval: true });
      continue;
    }
    const external =
      action.type === "forward" ||
      action.type === "send" ||
      action.type === "exfiltrate" ||
      action.type === "memory_write" ||
      Boolean(action.to && !action.to.toLowerCase().endsWith("@northline.io"));
    const hitsGoal = goalHit([action], goal);
    const stranger = !recipientAllowed(action, allow);
    if (guard.verdict === "quarantine" && (external || hitsGoal)) {
      withheld.push({ ...action, needsApproval: true, risk: "external" });
      continue;
    }
    if (hitsGoal || stranger) {
      withheld.push({ ...action, needsApproval: true, risk: "external" });
      continue;
    }
    if (action.type === "send" || action.type === "forward") {
      kept.push({ ...action, risk: "external", needsApproval: true });
      continue;
    }
    if (external && action.type !== "draft_reply" && action.type !== "label" && action.type !== "reminder") {
      kept.push({ ...action, risk: "external", needsApproval: true });
      continue;
    }
    kept.push({ ...action, risk: "local", needsApproval: false });
  }
  return { actions: kept, withheld };
}

/** Second guard, before any tool runs. A thrown scanner denies every action. */
export function runOutputGate(
  actions: ProposedAction[],
  guard: Pick<GuardResult, "verdict">,
  goal?: AttackerGoal,
  allow?: Set<string>,
): { actions: ProposedAction[]; withheld: ProposedAction[]; guardDown: boolean; summary: string } {
  try {
    const blocked: ProposedAction[] = [];
    const passed: ProposedAction[] = [];
    for (const action of actions) {
      const scan = scanEmail({
        text: [action.title, action.detail, action.to ?? ""].filter(Boolean).join("\n"),
        fromName: "Inbox Bodyguard",
        fromEmail: "guard@northline.io",
        subject: "tool call",
      });
      if (scan.verdict === "quarantine") {
        blocked.push({ ...action, risk: "external", needsApproval: true });
      } else {
        passed.push(action);
      }
    }
    const gated = applyGate(passed, guard, goal, allow);
    const withheld = [...blocked, ...gated.withheld];
    const summary =
      guard.verdict === "quarantine"
        ? "Second gate. Inbound quarantine stands, so external tools stay denied."
        : withheld.length > 0
          ? "Output guard denied a tool call before anything ran."
          : "Output guard passed. External mail still waits for approval. Nothing is transmitted.";
    return { actions: gated.actions, withheld, guardDown: false, summary };
  } catch {
    return {
      actions: [],
      withheld: actions.map((action) => ({ ...action, risk: "external" as const, needsApproval: true })),
      guardDown: true,
      summary: "Output guard failed closed. Nothing was sent.",
    };
  }
}

export function removeSpans(text: string, spans: string[]): string {
  let next = text;
  for (const span of spans) {
    const clean = span.trim();
    if (clean.length < 8) continue;
    if (next.includes(clean)) next = next.replace(clean, "");
  }
  return next.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
