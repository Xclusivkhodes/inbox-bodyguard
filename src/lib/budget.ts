import { randomUUID } from "node:crypto";

import {
  budgetUsd,
  effectiveAssistantModel,
  isSuperModel,
  isUltraModel,
  llmEnabled,
  SUPER_MODEL,
} from "./config";
import { getDb } from "./db";

/** Per-million-token USD from the Token Factory catalog on 25 Oct 2026. */
const RATES = [
  { test: /ultra/i, input: 1, output: 3 },
  { test: /super/i, input: 0.3, output: 0.9 },
  { test: /./, input: 0.06, output: 0.24 },
];

export type BudgetStatus = {
  spentUsd: number;
  budgetUsd: number;
  soft: boolean;
  hard: boolean;
  llmEnabled: boolean;
  adminPaused: boolean;
  paused: boolean;
  nanoOnly: boolean;
  banner: string | null;
  ledgerOk: boolean;
};

let ledgerBroken = false;

export function estimateUsd(model: string, promptTokens: number, completionTokens: number): number {
  const rate = RATES.find((entry) => entry.test.test(model)) ?? RATES[2];
  return (promptTokens / 1_000_000) * rate.input + (completionTokens / 1_000_000) * rate.output;
}

function adminPaused(): boolean {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = 'llm_admin_pause'").get() as
    | { value?: string }
    | undefined;
  return row?.value === "1";
}

export function budgetStatus(): BudgetStatus {
  const budget = budgetUsd();
  const enabled = llmEnabled();
  try {
    if (ledgerBroken) throw new Error("Spend ledger is unavailable.");
    const row = getDb().prepare("SELECT COALESCE(SUM(usd), 0) AS usd FROM spend_ledger").get() as
      | { usd?: number }
      | undefined;
    const spent = Number(row?.usd ?? 0);
    const pausedByAdmin = adminPaused();
    const soft = spent >= budget * 0.7;
    const hard = spent >= budget * 0.9;
    let banner: string | null = null;
    if (hard) banner = "Live AI paused, showing cached demo";
    else if (pausedByAdmin) banner = "Live AI is paused.";
    else if (soft) banner = "Spend is near the cap. New calls use Nemotron Nano only.";
    return {
      spentUsd: Math.round(spent * 1_000_000) / 1_000_000,
      budgetUsd: budget,
      soft,
      hard,
      llmEnabled: enabled,
      adminPaused: pausedByAdmin,
      paused: !enabled || pausedByAdmin || hard,
      nanoOnly: soft || hard || !enabled || pausedByAdmin,
      banner,
      ledgerOk: true,
    };
  } catch {
    ledgerBroken = true;
    return {
      spentUsd: 0,
      budgetUsd: budget,
      soft: true,
      hard: true,
      llmEnabled: enabled,
      adminPaused: true,
      paused: true,
      nanoOnly: true,
      banner: "Spend ledger is unavailable. Live calls are off.",
      ledgerOk: false,
    };
  }
}

export function recordSpend(input: {
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimated: boolean;
  purpose: string;
}): number {
  const usd = estimateUsd(input.model, input.promptTokens, input.completionTokens);
  try {
    getDb()
      .prepare(
        `INSERT INTO spend_ledger (id, model, prompt_tokens, completion_tokens, usd, estimated, purpose, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        input.model,
        input.promptTokens,
        input.completionTokens,
        usd,
        input.estimated ? 1 : 0,
        input.purpose,
        new Date().toISOString(),
      );
  } catch {
    ledgerBroken = true;
  }
  return usd;
}

export function setAdminPause(paused: boolean): void {
  getDb()
    .prepare(
      `INSERT INTO meta (key, value) VALUES ('llm_admin_pause', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(paused ? "1" : "0");
}

export function assistantModelFor(input: {
  classifierMode: string;
  confidence: number;
  quarantined: boolean;
}): { model: string; escalated: boolean } {
  const status = budgetStatus();
  const escalate =
    input.classifierMode === "live" &&
    input.confidence < 0.8 &&
    !input.quarantined &&
    status.ledgerOk &&
    !status.nanoOnly;
  if (escalate) return { model: SUPER_MODEL, escalated: true };
  return { model: effectiveAssistantModel(), escalated: false };
}

/** Called only after a cache miss. Fail closed when the ledger or the kill switch is unavailable. */
export function assertSpendAllowed(model: string, purpose: string): void {
  if (isUltraModel(model)) throw new Error("Ultra is not on the live path.");
  if (purpose === "guard" && (isSuperModel(model) || isUltraModel(model))) {
    throw new Error("The guard does not call Super.");
  }
  const status = budgetStatus();
  if (!status.ledgerOk || status.hard || !status.llmEnabled || status.adminPaused) {
    throw new Error(status.banner || "Live calls are paused.");
  }
  if (isSuperModel(model) && status.nanoOnly) {
    throw new Error("Spend is near the cap. Super is off.");
  }
}
