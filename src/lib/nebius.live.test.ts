import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "ib-live-"));
process.env.BODYGUARD_DB = path.join(dir, "t.db");
process.env.DEMO_MODE = "false";
process.env.LLM_ENABLED = "true";
process.env.BODYGUARD_ALLOW_LIVE = "1";
process.env.NEBIUS_API_KEY = "test-key";
process.env.SPEND_BUDGET_USD = "100";
process.env.NEBIUS_BASE_URL = "https://tokenfactory.test/v1";
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.NEBIUS_GUARD_MODEL;
delete process.env.NEBIUS_ASSISTANT_MODEL;

const NANO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
const SUPER = "nvidia/nemotron-3-super-120b-a12b";

async function ledgerCount(): Promise<number> {
  const { getDb } = await import("./db");
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM spend_ledger").get() as { n?: number };
  return Number(row?.n ?? 0);
}

describe("mocked token factory", () => {
  beforeEach(async () => {
    const { resetBreaker } = await import("./nebius");
    resetBreaker();
  });

  it("does not cache a malformed completion, and a billable 200 is spent once", async () => {
    const { closeDb } = await import("./db");
    closeDb();
    const { nebiusChat } = await import("./nebius");
    const { chatCacheKey, completionCap, readCached } = await import("./llm-cache");
    const { classifierOutput } = await import("./llm-schema");
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return Response.json({
        model: NANO,
        choices: [{ message: { content: '{"verdict":"clear","extra":true}' } }],
        usage: { prompt_tokens: 12, completion_tokens: 6 },
      });
    }) as typeof fetch;
    const parts = {
      model: NANO,
      system: "judge",
      user: "malformed-shape",
      temperature: 0,
      maxTokens: completionCap(300),
    };
    try {
      const before = await ledgerCount();
      await assert.rejects(
        () => nebiusChat({ ...parts, purpose: "guard", schema: classifierOutput }),
        /unexpected shape/,
      );
      assert.equal(readCached(chatCacheKey(parts)), null);
      assert.equal(await ledgerCount(), before + 1);
      await assert.rejects(() => nebiusChat({ ...parts, purpose: "guard", schema: classifierOutput }));
      assert.equal(calls, 2);
      assert.equal(readCached(chatCacheKey(parts)), null);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("retries a 429 once and records spend for the successful call only", async () => {
    const { nebiusChat } = await import("./nebius");
    const { classifierOutput } = await import("./llm-schema");
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) return new Response("busy", { status: 429, headers: { "retry-after": "0" } });
      return Response.json({
        model: NANO,
        choices: [{ message: { content: '{"verdict":"clear"}' } }],
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      });
    }) as typeof fetch;
    try {
      const before = await ledgerCount();
      const result = await nebiusChat({
        model: NANO,
        system: "judge",
        user: "retry-429",
        temperature: 0,
        maxTokens: 300,
        purpose: "guard",
        schema: classifierOutput,
      });
      assert.equal(calls, 2);
      assert.equal(result.cached, false);
      assert.match(result.content, /clear/);
      assert.equal(await ledgerCount(), before + 1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("opens the breaker after repeated 500s and does not fetch while it is open", async () => {
    const { breakerOpen, BreakerOpenError, nebiusChat } = await import("./nebius");
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("down", { status: 500, headers: { "retry-after": "0" } });
    }) as typeof fetch;
    try {
      let opened = false;
      for (let i = 0; i < 6 && !opened; i += 1) {
        await assert.rejects(() =>
          nebiusChat({
            model: NANO,
            system: "judge",
            user: `boom-${i}`,
            purpose: "assistant",
            maxTokens: 64,
          }),
        );
        opened = breakerOpen();
      }
      assert.equal(opened, true);
      const frozen = calls;
      await assert.rejects(
        () => nebiusChat({ model: NANO, system: "judge", user: "after-open", purpose: "assistant", maxTokens: 64 }),
        (error: unknown) => error instanceof BreakerOpenError,
      );
      assert.equal(calls, frozen);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("stops at the letter deadline when the upstream never answers", async () => {
    const { nebiusChat, runWithLlmBudget } = await import("./nebius");
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        calls += 1;
        const signal = init?.signal;
        const abort = () => reject(new DOMException("The operation was aborted", "AbortError"));
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      })) as typeof fetch;
    try {
      const started = Date.now();
      await assert.rejects(() =>
        runWithLlmBudget(
          () =>
            nebiusChat({
              model: NANO,
              system: "judge",
              user: "timeout-letter",
              purpose: "assistant",
              maxTokens: 64,
            }),
          80,
        ),
      );
      assert.ok(Date.now() - started < 3_000);
      assert.ok(calls >= 1 && calls <= 2);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not send a second request when content is empty", async () => {
    const { nebiusChat } = await import("./nebius");
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return Response.json({
        model: SUPER,
        choices: [{ message: { content: null, reasoning_content: "no json in here" } }],
        usage: { prompt_tokens: 4, completion_tokens: 4 },
      });
    }) as typeof fetch;
    try {
      await assert.rejects(
        () =>
          nebiusChat({
            model: SUPER,
            system: "planner",
            user: "empty-content",
            purpose: "assistant",
            maxTokens: 64,
          }),
        /No retry was sent/,
      );
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("serves the demo judgment with mode fallback while the breaker is open", async () => {
    const { breakerOpen, nebiusChat } = await import("./nebius");
    const { assessEmail } = await import("./pipeline");
    const { fixtures } = await import("./fixtures");
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("down", { status: 500, headers: { "retry-after": "0" } });
    }) as typeof fetch;
    try {
      for (let i = 0; i < 6 && !breakerOpen(); i += 1) {
        await assert.rejects(() =>
          nebiusChat({ model: NANO, system: "judge", user: `open-${i}`, purpose: "assistant", maxTokens: 64 }),
        );
      }
      assert.equal(breakerOpen(), true);
      const frozen = calls;
      const before = await ledgerCount();
      const email = fixtures.find((item) => item.id === "homoglyph-agenda");
      assert.ok(email);
      const assessment = await assessEmail(email, { live: true, measureSandbox: false });
      assert.equal(assessment.classifier.mode, "fallback");
      assert.equal(calls, frozen);
      assert.equal(await ledgerCount(), before);
      assert.equal(assessment.guardDown, false);
      assert.ok(assessment.trace.some((step) => step.mode === "fallback" && step.role === "assistant"));
    } finally {
      globalThis.fetch = original;
    }
  });
});
