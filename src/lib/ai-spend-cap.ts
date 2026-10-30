/**
 * Hard spend cap for live Token Factory calls.
 *
 * Every live call reserves its worst-case cost (estimated prompt tokens at the input
 * price + max_tokens at the output price) before the request is sent. If the reservation
 * would push the running total over the cap, the call is refused and the app falls back
 * to demo mode. After the response, the reservation is replaced by the real cost from the
 * API `usage` fields. If usage is missing, or the request timed out, the worst case is kept.
 *
 * Cap: AI_SPEND_CAP_USD (default 0.3). The running total is stored in:
 *   1. Upstash Redis / Vercel KV (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or
 *      KV_REST_API_URL + KV_REST_API_TOKEN). Durable and shared by every instance.
 *   2. A JSON file otherwise (AI_SPEND_FILE, default data/ai-spend.json). Survives
 *      restarts on a VM or a disk, but NOT on Vercel: /tmp is per instance and is wiped on
 *      cold start. So on Vercel without Redis, live calls are refused unless
 *      AI_SPEND_ALLOW_EPHEMERAL=1 is set on purpose.
 */
import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_AI_SPEND_CAP_USD = 0.3;
const APP_KEY = "inbox-bodyguard";

/** USD per 1M tokens, Nebius Token Factory public catalog, checked 30 Oct 2026. */
const PRICES: Array<{ test: RegExp; input: number; output: number }> = [
  { test: /ultra/i, input: 1, output: 3 },
  { test: /super/i, input: 0.3, output: 0.9 },
  { test: /nano|lightning/i, input: 0.06, output: 0.24 },
];
/** Unknown models are priced like Ultra so the cap errs on the safe side. */
const UNKNOWN_PRICE = { input: 1, output: 3 };

export const CAP_REACHED_MESSAGE =
  "The AI spend cap for this app is used up, so live AI is off. Showing demo results instead.";
export const CAP_STORE_MISSING_MESSAGE =
  "Live AI is off: this deployment has no durable spend store (add Upstash Redis / Vercel KV, or set AI_SPEND_ALLOW_EPHEMERAL=1). Showing demo results instead.";

export class SpendCapError extends Error {
  constructor(
    message: string,
    readonly reason: "cap" | "store",
  ) {
    super(message);
    this.name = "SpendCapError";
  }
}

export function priceFor(model: string): { input: number; output: number } {
  const hit = PRICES.find((entry) => entry.test.test(model));
  return hit ? { input: hit.input, output: hit.output } : UNKNOWN_PRICE;
}

export function costUsd(model: string, promptTokens: number, completionTokens: number): number {
  const price = priceFor(model);
  const usd = (Math.max(0, promptTokens) * price.input + Math.max(0, completionTokens) * price.output) / 1_000_000;
  return Math.round(usd * 1e9) / 1e9;
}

/** Rough token count for a prompt: chars / 3 (over-counts English on purpose) + 1,600 per image. */
export function estimatePromptTokens(text: string, images = 0): number {
  return Math.ceil(text.length / 3) + images * 1600 + 16;
}

/**
 * AI_SPEND_CAP_USD wins. Otherwise the default. The older SPEND_BUDGET_USD can only lower the
 * cap, so a leftover "SPEND_BUDGET_USD=1" from an old .env cannot raise it past the default.
 */
export function aiSpendCapUsd(): number {
  const explicit = readUsd("AI_SPEND_CAP_USD");
  if (explicit != null) return explicit;
  const legacy = readUsd("SPEND_BUDGET_USD");
  return legacy != null ? Math.min(legacy, DEFAULT_AI_SPEND_CAP_USD) : DEFAULT_AI_SPEND_CAP_USD;
}

function readUsd(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

type Store = {
  kind: "redis" | "file" | "memory";
  get(): Promise<number>;
  add(delta: number): Promise<number>;
};

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

const REDIS_KEY = `ai-spend-cap:${APP_KEY}:usd`;

function redisStore(config: { url: string; token: string }): Store {
  async function call(command: string[]): Promise<number> {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error("Spend store is unavailable.");
    const body = (await response.json()) as { result?: unknown };
    const value = Number(body.result ?? 0);
    if (!Number.isFinite(value)) throw new Error("Spend store returned a bad value.");
    return value;
  }
  return {
    kind: "redis",
    get: () => call(["GET", REDIS_KEY]),
    add: (delta) => call(["INCRBYFLOAT", REDIS_KEY, String(delta)]),
  };
}

function filePath(): string {
  const configured = process.env.AI_SPEND_FILE?.trim();
  if (configured) return configured;
  if (process.env.VERCEL) return path.join("/tmp", `${APP_KEY}-ai-spend.json`);
  return path.join(process.cwd(), "data", "ai-spend.json");
}

function fileStore(file: string): Store {
  let total: number | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  const load = () => {
    if (total != null) return total;
    try {
      const parsed = JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as { usd?: number };
      total = typeof parsed.usd === "number" && Number.isFinite(parsed.usd) ? parsed.usd : 0;
    } catch {
      total = 0;
    }
    return total;
  };
  return {
    kind: "file",
    get: async () => load(),
    add: async (delta) => {
      const next = Math.round((load() + delta) * 1e9) / 1e9;
      total = next;
      const snapshot = JSON.stringify({ usd: next, updatedAt: new Date().toISOString() });
      chain = chain
        .then(async () => {
          await mkdir(path.dirname(file), { recursive: true });
          const tmp = `${file}.${process.pid}.tmp`;
          await writeFile(tmp, snapshot);
          await rename(tmp, file);
        })
        .catch(() => undefined);
      await chain;
      return next;
    },
  };
}

function memoryStore(): Store {
  let total = 0;
  return {
    kind: "memory",
    get: async () => total,
    add: async (delta) => {
      total = Math.round((total + delta) * 1e9) / 1e9;
      return total;
    },
  };
}

let store: Store | null = null;
let lastKnownUsd = 0;
let storeKey = "";

function currentStoreKey(): string {
  const redis = redisConfig();
  if (redis) return `redis:${redis.url}`;
  const forced = process.env.AI_SPEND_STORE?.trim();
  if (forced === "memory") return "memory";
  if (!forced && (process.env.NODE_ENV === "test" || process.env.VITEST || process.env.NODE_TEST_CONTEXT)) return "memory";
  return `file:${filePath()}`;
}

function getStore(): Store {
  const key = currentStoreKey();
  if (store && key === storeKey) return store;
  storeKey = key;
  const redis = redisConfig();
  if (redis) store = redisStore(redis);
  else if (key === "memory") store = memoryStore();
  else store = fileStore(filePath());
  return store;
}

export function spendStoreKind(): "redis" | "file" | "memory" {
  return getStore().kind;
}

/** True when the running total would not survive a cold start or be shared across instances. */
export function spendStoreEphemeral(): boolean {
  return Boolean(process.env.VERCEL) && spendStoreKind() !== "redis";
}

function storeAllowed(): boolean {
  if (!spendStoreEphemeral()) return true;
  return process.env.AI_SPEND_ALLOW_EPHEMERAL?.trim() === "1";
}

export type Reservation = { model: string; reservedUsd: number; settled: boolean };

/** Reserve the worst-case cost of one call. Throws SpendCapError when the cap would be passed. */
export async function reserveSpend(model: string, promptTokens: number, maxTokens: number): Promise<Reservation> {
  if (!storeAllowed()) throw new SpendCapError(CAP_STORE_MISSING_MESSAGE, "store");
  const cap = aiSpendCapUsd();
  const worst = costUsd(model, promptTokens, maxTokens);
  const s = getStore();
  let after: number;
  try {
    after = await s.add(worst);
  } catch {
    throw new SpendCapError(CAP_STORE_MISSING_MESSAGE, "store");
  }
  if (after > cap + 1e-12) {
    try {
      lastKnownUsd = await s.add(-worst);
    } catch {
      lastKnownUsd = after;
    }
    throw new SpendCapError(CAP_REACHED_MESSAGE, "cap");
  }
  lastKnownUsd = after;
  return { model, reservedUsd: worst, settled: false };
}

/**
 * Replace a reservation with the real cost. Pass null usage to keep the worst case
 * (timeouts, or a reply without usage). Pass { promptTokens: 0, completionTokens: 0 }
 * to release it when the provider rejected the request before generating anything.
 */
export async function settleSpend(
  reservation: Reservation,
  usage: { promptTokens: number; completionTokens: number } | null,
): Promise<number> {
  if (reservation.settled) return 0;
  reservation.settled = true;
  if (!usage) return reservation.reservedUsd;
  const actual = costUsd(reservation.model, usage.promptTokens, usage.completionTokens);
  const delta = actual - reservation.reservedUsd;
  if (delta !== 0) {
    try {
      lastKnownUsd = await getStore().add(delta);
    } catch {
      /* keep the reservation: over-counting is the safe side */
    }
  }
  return actual;
}

export async function aiSpendSnapshot() {
  let spent = lastKnownUsd;
  try {
    spent = await getStore().get();
    lastKnownUsd = spent;
  } catch {
    /* use last known */
  }
  const cap = aiSpendCapUsd();
  return {
    capUsd: cap,
    spentUsd: Math.round(spent * 1e6) / 1e6,
    remainingUsd: Math.max(0, Math.round((cap - spent) * 1e6) / 1e6),
    capReached: spent >= cap,
    store: spendStoreKind(),
    ephemeral: spendStoreEphemeral(),
    liveAllowedByStore: storeAllowed(),
  };
}

/** Last total this process saw. Sync, for status banners. */
export function lastKnownAiSpendUsd(): number {
  return lastKnownUsd;
}

export function aiCapReachedSync(): boolean {
  return lastKnownUsd >= aiSpendCapUsd();
}

export function resetAiSpendForTests(): void {
  store = null;
  storeKey = "";
  lastKnownUsd = 0;
}
