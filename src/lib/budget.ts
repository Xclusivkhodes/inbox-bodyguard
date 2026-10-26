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
import { addRemoteSpend, noteRemoteSpend, remoteSpendState, spendBackend } from "./spend-remote";
import type { LetterCost, ModelUsage } from "./types";

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

export function usageFrom(result: {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  cached: boolean;
}): ModelUsage {
  return {
    model: result.model,
    promptTokens: result.promptTokens ?? 0,
    completionTokens: result.completionTokens ?? 0,
    cached: result.cached,
  };
}

export function formatUsd(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(2)}`;
}

/** Demo and skipped scans cost nothing. Live scans use the same rates as the ledger. */
export function quoteLetter(usages: ModelUsage[], live: boolean): LetterCost {
  if (!live || usages.length === 0) {
    return { usd: 0, calls: 0, cached: 0, note: "No Token Factory call was made." };
  }
  const paid = usages.filter((item) => !item.cached);
  const cached = usages.length - paid.length;
  if (paid.length === 0) {
    return {
      usd: 0,
      calls: 0,
      cached,
      note:
        cached === 1
          ? "Served from cache. No new Token Factory charge."
          : `Served ${cached} calls from cache. No new Token Factory charge.`,
    };
  }
  const usd =
    Math.round(
      paid.reduce((sum, item) => sum + estimateUsd(item.model, item.promptTokens, item.completionTokens), 0) * 1_000_000,
    ) / 1_000_000;
  const cacheNote = cached > 0 ? ` ${cached} more ${cached === 1 ? "was" : "were"} served from cache.` : "";
  return {
    usd,
    calls: paid.length,
    cached,
    note: `Estimated ${formatUsd(usd)} for ${paid.length} live call${paid.length === 1 ? "" : "s"} at the 25 Oct 2026 catalog rates.${cacheNote}`,
  };
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
    const remote = remoteSpendState();
    if (remote.active && (remote.broken || remote.spent == null || !Number.isFinite(remote.spent))) {
      throw new Error("Spend ledger is unavailable.");
    }
    const row = getDb().prepare("SELECT value FROM meta WHERE key = 'spend_usd'").get() as { value?: string } | undefined;
    const spent = remote.active ? Number(remote.spent) : Number(row?.value ?? 0);
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
    const db = getDb();
    const current = db.prepare("SELECT value FROM meta WHERE key = 'spend_usd'").get() as { value?: string } | undefined;
    const next = Number(current?.value ?? 0) + usd;
    db.exec("BEGIN");
    db.prepare(
      `INSERT INTO spend_ledger (id, model, prompt_tokens, completion_tokens, usd, estimated, purpose, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      input.model,
      input.promptTokens,
      input.completionTokens,
      usd,
      input.estimated ? 1 : 0,
      input.purpose,
      new Date().toISOString(),
    );
    db.prepare(
      `INSERT INTO meta (key, value) VALUES ('spend_usd', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(String(next));
    db.exec("COMMIT");
    if (spendBackend() !== "sqlite") {
      noteRemoteSpend(usd);
      void addRemoteSpend(usd).catch(() => {
        ledgerBroken = true;
      });
    }
  } catch {
    try {
      getDb().exec("ROLLBACK");
    } catch {
      /* no open transaction */
    }
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
