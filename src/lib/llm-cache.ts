import { createHash } from "node:crypto";

import { EMAIL_BODY_CAP, HARD_TOKEN_CEILING, maxTokens, PIPELINE_VERSION } from "./config";
import { getDb } from "./db";

export type CacheEntry = {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  fromReasoning: boolean;
  createdAt: string;
  prewarmed?: boolean;
};

export type ChatParts = {
  model: string;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
};

const CACHE_CAP = 400;

type CacheRow = {
  content?: string;
  model?: string;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  from_reasoning?: number;
  created_at?: string;
  prewarmed?: number;
};

function rowToEntry(row: CacheRow): CacheEntry | null {
  if (!row.content) return null;
  return {
    content: row.content,
    model: row.model || "",
    promptTokens: row.prompt_tokens ?? undefined,
    completionTokens: row.completion_tokens ?? undefined,
    fromReasoning: row.from_reasoning === 1,
    createdAt: row.created_at || new Date().toISOString(),
    prewarmed: row.prewarmed === 1,
  };
}

export function completionCap(requested?: number): number {
  return Math.min(requested ?? maxTokens(), maxTokens(), HARD_TOKEN_CEILING);
}

export function chatCacheKey(parts: ChatParts): string {
  const cap = completionCap(parts.maxTokens);
  return createHash("sha256")
    .update(
      JSON.stringify({
        app: "inbox-bodyguard",
        pipeline: PIPELINE_VERSION,
        model: parts.model,
        system: parts.system,
        user: parts.user.slice(0, EMAIL_BODY_CAP),
        temperature: parts.temperature,
        maxTokens: cap,
      }),
    )
    .digest("hex");
}

export function readCached(key: string): CacheEntry | null {
  const row = getDb().prepare(
    `SELECT content, model, prompt_tokens, completion_tokens, from_reasoning, created_at, prewarmed
     FROM llm_cache WHERE key = ?`,
  ).get(key) as CacheRow | undefined;
  const entry = row ? rowToEntry(row) : null;
  if (!entry) return null;
  getDb().prepare("UPDATE llm_cache SET last_used = ? WHERE key = ?").run(new Date().toISOString(), key);
  return entry;
}

function pruneCache(): void {
  const count = getDb().prepare("SELECT COUNT(*) AS n FROM llm_cache").get() as { n?: number } | undefined;
  const extra = Number(count?.n ?? 0) - CACHE_CAP;
  if (extra <= 0) return;
  getDb()
    .prepare(
      `DELETE FROM llm_cache WHERE key IN (
         SELECT key FROM llm_cache ORDER BY prewarmed ASC, last_used ASC LIMIT ?
       )`,
    )
    .run(extra);
}

/** SQLite replaces the JSON file. A transaction plus WAL is crash-safe, unlike a full-file rewrite. */
export function writeCached(key: string, entry: CacheEntry): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO llm_cache (key, content, model, prompt_tokens, completion_tokens, from_reasoning, created_at, prewarmed, last_used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       content = excluded.content,
       model = excluded.model,
       prompt_tokens = excluded.prompt_tokens,
       completion_tokens = excluded.completion_tokens,
       from_reasoning = excluded.from_reasoning,
       created_at = excluded.created_at,
       prewarmed = excluded.prewarmed,
       last_used = excluded.last_used
     WHERE llm_cache.prewarmed = 1 OR excluded.prewarmed = 0`,
  ).run(
    key,
    entry.content,
    entry.model,
    entry.promptTokens ?? null,
    entry.completionTokens ?? null,
    entry.fromReasoning ? 1 : 0,
    entry.createdAt || now,
    entry.prewarmed ? 1 : 0,
    now,
  );
  pruneCache();
}

/** Demo seeds. A real Token Factory response is never overwritten. */
export function rememberChat(parts: ChatParts, content: string): void {
  const key = chatCacheKey(parts);
  const existing = readCached(key);
  if (existing && !existing.prewarmed) return;
  writeCached(key, {
    content,
    model: parts.model,
    fromReasoning: false,
    createdAt: new Date().toISOString(),
    prewarmed: true,
  });
}
