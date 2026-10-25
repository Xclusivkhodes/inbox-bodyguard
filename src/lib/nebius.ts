import { assertLiveOptIn, baseURL, EMAIL_BODY_CAP, HARD_TOKEN_CEILING } from "./config";
import { assertSpendAllowed, recordSpend } from "./budget";
import { chatCacheKey, completionCap, readCached, writeCached } from "./llm-cache";
import { LimitError, withLiveSlot } from "./limits";

export class NebiusError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "NebiusError";
    this.status = status;
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

  try {
    assertSpendAllowed(options.model, purpose);
    assertLiveOptIn();
  } catch (error) {
    throw new NebiusError(error instanceof Error ? error.message : "Live calls are paused.", 409);
  }

  const apiKey = process.env.NEBIUS_API_KEY?.trim();
  if (!apiKey) throw new NebiusError("NEBIUS_API_KEY is not set.", 0);

  const body: Record<string, unknown> = {
    model: options.model,
    temperature,
    max_tokens: cap,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  };
  if (reasoningModel(options.model)) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  const started = Date.now();
  const payload = await withLiveSlot(async () => {
    const response = await fetch(`${baseURL()}chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 180).replace(/\s+/g, " ");
      throw new NebiusError(`Token Factory returned ${response.status}. ${detail}`, response.status);
    }
    return (await response.json()) as {
      model?: string;
      choices?: { message?: { content?: unknown; reasoning_content?: unknown } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
  });

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
  const promptTokens = payload.usage?.prompt_tokens ?? Math.ceil((options.system.length + user.length) / 4);
  const completionTokens = payload.usage?.completion_tokens ?? cap;
  recordSpend({
    model: payload.model || options.model,
    promptTokens,
    completionTokens,
    estimated,
    purpose,
  });

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
