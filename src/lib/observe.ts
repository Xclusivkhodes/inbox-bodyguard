import { createHash, randomUUID } from "node:crypto";

import { demoMode } from "./config";
import { clientIp } from "./limits";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BUCKETS = [5, 10, 25, 50, 100, 150, 250, 400, 800, 1500, 3000, 8000];

type Hist = { buckets: number[]; count: number; sum: number };

const routes = new Map<string, Hist>();
const models = new Map<string, Hist>();

function hist(): Hist {
  return { buckets: BUCKETS.map(() => 0), count: 0, sum: 0 };
}

function observe(map: Map<string, Hist>, key: string, ms: number): void {
  const row = map.get(key) ?? hist();
  row.count += 1;
  row.sum += ms;
  const index = BUCKETS.findIndex((edge) => ms <= edge);
  row.buckets[index === -1 ? BUCKETS.length - 1 : index] += 1;
  map.set(key, row);
}

function percentile(row: Hist, p: number): number {
  if (row.count === 0) return 0;
  const target = Math.ceil((p / 100) * row.count);
  let seen = 0;
  for (let i = 0; i < row.buckets.length; i += 1) {
    seen += row.buckets[i];
    if (seen >= target) return BUCKETS[i];
  }
  return BUCKETS[BUCKETS.length - 1];
}

export function requestIdFrom(request: Request): string {
  const inbound = request.headers.get("x-request-id")?.trim() ?? "";
  return UUID.test(inbound) ? inbound : randomUUID();
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

export function promptDigest(text: string): { sha256: string; length: number } {
  return { sha256: createHash("sha256").update(text).digest("hex").slice(0, 16), length: text.length };
}

export function logJson(entry: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}

export function logRequest(input: { request: Request; route: string; status: number; ms: number; mode?: string }): void {
  const requestId = requestIdFrom(input.request);
  observe(routes, input.route, input.ms);
  logJson({
    level: input.status >= 500 ? "error" : "info",
    requestId,
    route: input.route,
    status: input.status,
    ms: input.ms,
    mode: input.mode ?? (demoMode() ? "demo" : "live"),
    ipHash: hashIp(clientIp(input.request)),
  });
}

export function logLlm(entry: {
  model: string;
  purpose: string;
  attempt: number;
  ms: number;
  promptTokens?: number;
  completionTokens?: number;
  usd?: number;
  outcome: string;
  cacheHit: boolean;
  promptSha?: string;
  promptLength?: number;
}): void {
  observe(models, entry.model, entry.ms);
  logJson({ level: "info", kind: "llm", ...entry });
}

export function metricsSnapshot(): {
  routes: { route: string; count: number; p50: number; p95: number; p99: number }[];
  models: { model: string; count: number; p50: number; p95: number; p99: number }[];
} {
  const pack = (map: Map<string, Hist>, key: string) =>
    [...map.entries()].map(([name, row]) => ({
      [key]: name,
      count: row.count,
      p50: percentile(row, 50),
      p95: percentile(row, 95),
      p99: percentile(row, 99),
    }));
  return {
    routes: pack(routes, "route") as { route: string; count: number; p50: number; p95: number; p99: number }[],
    models: pack(models, "model") as { model: string; count: number; p50: number; p95: number; p99: number }[],
  };
}
