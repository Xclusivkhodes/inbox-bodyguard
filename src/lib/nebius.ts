import { AsyncLocalStorage } from "node:async_hooks";

import type { ZodType } from "zod";

import { assertLiveOptIn, baseURL, EMAIL_BODY_CAP, HARD_TOKEN_CEILING, isSuperModel } from "./config";
import { estimatePromptTokens, reserveSpend, settleSpend, SpendCapError, type Reservation } from "./ai-spend-cap";
import { assertSpendAllowed, recordSpend } from "./budget";
import { chatCacheKey, completionCap, readCached, writeCached } from "./llm-cache";
import { LimitError, withLiveSlot } from "./limits";
import { logLlm, promptDigest } from "./observe";

export class NebiusError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "NebiusError";
    this.status = status;
  }
}

/** The AI spend cap would be passed by this call. The pipeline shows the demo result instead. */
export class SpendCapReachedError extends NebiusError {
  constructor(message: string) {
    super(message, 409);
    this.name = "SpendCapReachedError";
  }
}

export class BreakerOpenError extends NebiusError {
  constructor() {
    super("The model circuit is open.", 503);
    this.name = "BreakerOpenError";
  }
}

export type ChatResult = {
  content: string;
  model: string;
  ms: number;
  promptTokens?: number;
  completionTokens?: number;
  cached: boolean;
  maxTokens: number;
  fromReasoning: boolean;
};

const failures: number[] = [];
let breaker: "closed" | "open" | "half" = "closed";
let openedUntil = 0;

export function breakerOpen(): boolean {
  return breaker === "open" && Date.now() < openedUntil;
}

export function resetBreaker(): void {
  failures.length = 0;
  breaker = "closed";
  openedUntil = 0;
}

function noteFailure(): void {
  const now = Date.now();
  const recent = failures.filter((stamp) => now - stamp < 30_000);
  recent.push(now);
  failures.length = 0;
  failures.push(...recent);
  if (breaker === "half" || recent.length >= 5) {
    breaker = "open";
    openedUntil = now + 30_000;
  }
}

function noteSuccess(): void {
  failures.length = 0;
  breaker = "closed";
  openedUntil = 0;
}

function enterBreaker(): void {
  const now = Date.now();
  if (breaker === "open") {
    if (now < openedUntil) throw new BreakerOpenError();
    breaker = "half";
    return;
  }
  if (breaker === "half") throw new BreakerOpenError();
}

const budgetStore = new AsyncLocalStorage<{ deadline: AbortSignal; remaining: number }>();

export function llmBudgetActive(): boolean {
  return Boolean(budgetStore.getStore());
}

/** One deadline and one completion-token budget for a whole letter. */
export function runWithLlmBudget<T>(fn: () => Promise<T>, deadlineMs = 22_000, tokenBudget = 4096): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  return budgetStore.run({ deadline: controller.signal, remaining: tokenBudget }, async () => {
    try {
      return await fn();
    } finally {
      clearTimeout(timer);
    }
  });
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String(part.text ?? "");
        return "";
      })
      .join("");
  }
  return "";
}

export function extractJson(text: string): unknown {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model did not return JSON.");
  return JSON.parse(stripped.slice(start, end + 1));
}

function jsonSlice(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    JSON.parse(slice);
    return slice;
  } catch {
    return null;
  }
}

function reasoningModel(model: string): boolean {
  return /super|ultra/i.test(model);
}

/** OTP, PIN, card and Ghana Card numbers stay out of the live prompt and the logs. */
export function redactSecrets(text: string): string {
  return text
    .replace(/GHA-\d{9}-\d/gi, "[redacted]")
    .replace(/\b(otp|pin|cvv|cvc)\b([^0-9]{0,12})(\d{4,8})/gi, "$1$2[redacted]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, (match) => (match.replace(/\D/g, "").length >= 13 && match.replace(/\D/g, "").length <= 19 ? "[redacted-card]" : match));
}

function validatedContent(content: string, schema?: ZodType): void {
  let parsed: unknown;
  try {
    parsed = extractJson(content);
  } catch {
    throw new NebiusError("The model did not return JSON.", 200);
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new NebiusError("The model did not return JSON.", 200);
  }
  if (schema && !schema.safeParse(parsed).success) {
    throw new NebiusError("The model returned an unexpected shape.", 200);
  }
}

function sleep(ms: number, deadline?: AbortSignal): Promise<void> {
  if (deadline?.aborted) return Promise.reject(new NebiusError("The model deadline passed.", 504));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    deadline?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new NebiusError("The model deadline passed.", 504));
      },
      { once: true },
    );
  });
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(2_000, seconds * 1000);
  }
  const cap = Math.min(2_000, 250 * 2 ** attempt);
  return Math.random() * cap;
}

function transient(error: unknown, status?: number): boolean {
  if (status === 429 || (status != null && status >= 500)) return true;
  if (error instanceof NebiusError && (error.status === 429 || error.status >= 500 || error.status === 504)) return true;
  if (error instanceof Error && /timeout|ECONNRESET|aborted|network/i.test(error.message) && !(error instanceof NebiusError && error.status === 200)) {
    return true;
  }
  return false;
}

type CompletionPayload = {
  model?: string;
  choices?: { message?: { content?: unknown; reasoning_content?: unknown } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

async function postCompletion(
  body: Record<string, unknown>,
  apiKey: string,
  model: string,
  purpose: string,
  /** Called before retrying after a timeout or network error, because that attempt may have been billed. */
  beforeBlindRetry?: () => Promise<void>,
): Promise<CompletionPayload> {
  const slot = budgetStore.getStore();
  const timeoutMs = isSuperModel(model) ? 15_000 : 8_000;
  const perCall = AbortSignal.timeout(timeoutMs);
  const signal = slot ? AbortSignal.any([perCall, slot.deadline]) : perCall;
  let attempt = 0;
  let droppedFormat = false;
  let lastError: unknown;
  while (attempt < 2) {
    attempt += 1;
    const started = Date.now();
    try {
      const response = await fetch(`${baseURL()}chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
      if (response.status === 400 && !droppedFormat && body.response_format) {
        delete body.response_format;
        droppedFormat = true;
        attempt -= 1;
        continue;
      }
      if (!response.ok) {
        lastError = new NebiusError(`Token Factory returned ${response.status}.`, response.status);
        logLlm({ model, purpose, attempt, ms: Date.now() - started, outcome: String(response.status), cacheHit: false });
        if (attempt >= 2 || !transient(lastError, response.status)) throw lastError;
        noteFailure();
        await sleep(backoffMs(attempt, response.headers.get("retry-after")), slot?.deadline);
        continue;
      }
      noteSuccess();
      return (await response.json()) as CompletionPayload;
    } catch (error) {
      if (error instanceof NebiusError && error.status === 400) throw error;
      lastError = error instanceof NebiusError ? error : new NebiusError("Token Factory did not respond.", 504);
      if (attempt >= 2 || !transient(error, error instanceof NebiusError ? error.status : undefined)) {
        noteFailure();
        throw lastError;
      }
      noteFailure();
      if (beforeBlindRetry && !(error instanceof NebiusError && error.status !== 504)) await beforeBlindRetry();
      await sleep(backoffMs(attempt, null), slot?.deadline);
    }
  }
  noteFailure();
  throw lastError instanceof Error ? lastError : new NebiusError("Token Factory did not respond.", 504);
}

/**
 * One Token Factory chat completion.
 * Cache hits return before any opt-in or budget check, so a pre-warmed demo click spends nothing.
 * A cache miss fails closed when the kill switch, ledger, or opt-in is not in place.
 */
export async function nebiusChat(options: {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  purpose?: "guard" | "assistant" | "sandbox" | "safety";
  schema?: ZodType;
}): Promise<ChatResult> {
  const purpose = options.purpose ?? "assistant";
  const cap = completionCap(options.maxTokens);
  const temperature = options.temperature ?? 0;
  const user = options.user.slice(0, EMAIL_BODY_CAP);
  const key = chatCacheKey({
    model: options.model,
    system: options.system,
    user,
    temperature,
    maxTokens: cap,
  });
  const cached = readCached(key);
  if (cached) {
    logLlm({ model: cached.model, purpose, attempt: 0, ms: 0, outcome: "ok", cacheHit: true, promptTokens: cached.promptTokens, completionTokens: cached.completionTokens });
    return {
      content: cached.content,
      model: cached.model,
      ms: 0,
      promptTokens: cached.promptTokens,
      completionTokens: cached.completionTokens,
      cached: true,
      maxTokens: cap,
      fromReasoning: cached.fromReasoning,
    };
  }

  enterBreaker();

  const slot = budgetStore.getStore();
  if (slot) {
    if (slot.remaining < cap) throw new NebiusError("This letter used its token budget.", 409);
    slot.remaining -= cap;
  }

  try {
    assertSpendAllowed(options.model, purpose);
    assertLiveOptIn();
  } catch (error) {
    throw new NebiusError(error instanceof Error ? error.message : "Live calls are paused.", 409);
  }

  const apiKey = process.env.NEBIUS_API_KEY?.trim();
  if (!apiKey) throw new NebiusError("NEBIUS_API_KEY is not set.", 0);

  const liveUser = redactSecrets(user);
  const digest = promptDigest(liveUser);
  const body: Record<string, unknown> = {
    model: options.model,
    temperature,
    max_tokens: cap,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: liveUser },
    ],
    response_format: { type: "json_object" },
  };
  if (reasoningModel(options.model)) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  // Hard cap: reserve the worst case (prompt estimate + max_tokens) before anything is sent.
  const promptEstimate = estimatePromptTokens(options.system + liveUser);
  const reserve = async (): Promise<Reservation> => {
    try {
      return await reserveSpend(options.model, promptEstimate, cap);
    } catch (error) {
      if (error instanceof SpendCapError) throw new SpendCapReachedError(error.message);
      throw error;
    }
  };
  const reservation = await reserve();
  // A blind retry after a timeout keeps the first reservation and takes a new one.
  const extraReservations: Reservation[] = [];
  const beforeBlindRetry = async () => {
    extraReservations.push(await reserve());
  };

  const started = Date.now();
  let payload: CompletionPayload;
  try {
    payload = await withLiveSlot(() => postCompletion(body, apiKey, options.model, purpose, beforeBlindRetry));
  } catch (error) {
    // Keep the worst-case reservation: a timed-out request may still have been billed.
    await settleSpend(reservation, null);
    if (error instanceof BreakerOpenError || breakerOpen()) throw new BreakerOpenError();
    logLlm({
      model: options.model,
      purpose,
      attempt: 2,
      ms: Date.now() - started,
      outcome: error instanceof NebiusError && error.status ? String(error.status) : "timeout",
      cacheHit: false,
      promptSha: digest.sha256,
      promptLength: digest.length,
    });
    throw error;
  }

  await settleSpend(
    reservation,
    payload.usage?.prompt_tokens != null && payload.usage?.completion_tokens != null
      ? { promptTokens: payload.usage.prompt_tokens, completionTokens: payload.usage.completion_tokens }
      : null,
  );

  const message = payload.choices?.[0]?.message;
  const rawContent = messageText(message?.content).trim();
  const reasoning = messageText(message?.reasoning_content).trim();
  let content = rawContent;
  let fromReasoning = false;
  if (!content) {
    const recovered = jsonSlice(reasoning);
    if (recovered) {
      content = recovered;
      fromReasoning = true;
    } else if (reasoning) {
      throw new NebiusError(
        `${options.model} filled message.reasoning_content and left content null. The cap of ${cap} completion tokens was spent before the answer. Raise the role cap (ceiling ${HARD_TOKEN_CEILING}). No retry was sent.`,
        200,
      );
    } else {
      throw new NebiusError("Token Factory returned an empty completion.", 200);
    }
  }

  const estimated = payload.usage?.prompt_tokens == null;
  const promptTokens = payload.usage?.prompt_tokens ?? Math.ceil((options.system.length + liveUser.length) / 4);
  const completionTokens = payload.usage?.completion_tokens ?? cap;
  const usd = recordSpend({
    model: payload.model || options.model,
    promptTokens,
    completionTokens,
    estimated,
    purpose,
  });

  try {
    validatedContent(content, options.schema);
  } catch (error) {
    logLlm({
      model: payload.model || options.model,
      purpose,
      attempt: 1,
      ms: Date.now() - started,
      promptTokens,
      completionTokens,
      usd,
      outcome: "parse_error",
      cacheHit: false,
      promptSha: digest.sha256,
      promptLength: digest.length,
    });
    throw error;
  }

  const result: ChatResult = {
    content,
    model: payload.model || options.model,
    ms: Date.now() - started,
    promptTokens,
    completionTokens,
    cached: false,
    maxTokens: cap,
    fromReasoning,
  };
  writeCached(key, {
    content: result.content,
    model: result.model,
    promptTokens,
    completionTokens,
    fromReasoning,
    createdAt: new Date().toISOString(),
    prewarmed: false,
  });
  logLlm({
    model: result.model,
    purpose,
    attempt: 1,
    ms: result.ms,
    promptTokens,
    completionTokens,
    usd,
    outcome: "ok",
    cacheHit: false,
    promptSha: digest.sha256,
    promptLength: digest.length,
  });
  return result;
}

export function describeUsage(result: ChatResult): string {
  const via = result.cached ? "cache hit, no call" : "one request";
  const tokens =
    result.promptTokens != null
      ? `, ${result.promptTokens} prompt + ${result.completionTokens ?? 0} completion tokens`
      : "";
  const reasoning = result.fromReasoning ? ", answer taken from reasoning_content" : "";
  return `${via}, max_tokens ${result.maxTokens}${tokens}${reasoning}`;
}

export { LimitError };
