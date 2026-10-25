import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { EMAIL_BODY_CAP, HARD_TOKEN_CEILING, maxTokens, PIPELINE_VERSION } from "./config";

export type CacheEntry = {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  fromReasoning: boolean;
  createdAt: string;
  prewarmed?: boolean;
};

type CacheFile = Record<string, CacheEntry>;

export type ChatParts = {
  model: string;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
};

function cachePath(): string {
  return process.env.BODYGUARD_CACHE_PATH || path.join(process.cwd(), "data", "llm-cache.json");
}

function readCache(): CacheFile {
  try {
    const parsed = JSON.parse(readFileSync(/*turbopackIgnore: true*/ cachePath(), "utf8")) as CacheFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
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
  const entry = readCache()[key];
  if (!entry?.content) return null;
  return entry;
}

export function writeCached(key: string, entry: CacheEntry): void {
  const file = cachePath();
  mkdirSync(path.dirname(file), { recursive: true });
  const current = readCache();
  current[key] = entry;
  writeFileSync(/*turbopackIgnore: true*/ file, `${JSON.stringify(current)}\n`);
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
