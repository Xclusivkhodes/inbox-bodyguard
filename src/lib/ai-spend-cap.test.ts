import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "ib-cap-"));
process.env.BODYGUARD_DB = path.join(dir, "t.db");
process.env.BODYGUARD_CACHE_PATH = path.join(dir, "cache.json");

const NANO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
const SUPER = "nvidia/nemotron-3-super-120b-a12b";
const ENV_KEYS = [
  "AI_SPEND_CAP_USD",
  "SPEND_BUDGET_USD",
  "AI_SPEND_STORE",
  "AI_SPEND_FILE",
  "AI_SPEND_ALLOW_EPHEMERAL",
  "VERCEL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
];
const saved: Record<string, string | undefined> = {};

describe("AI spend cap", () => {
  beforeEach(async () => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.AI_SPEND_STORE = "memory";
    (await import("./ai-spend-cap")).resetAiSpendForTests();
  });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] == null) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("defaults to $0.30, honours AI_SPEND_CAP_USD, and lets the old env only lower it", async () => {
    const cap = await import("./ai-spend-cap");
    assert.equal(cap.aiSpendCapUsd(), 0.3);
    process.env.SPEND_BUDGET_USD = "1";
    assert.equal(cap.aiSpendCapUsd(), 0.3);
    process.env.SPEND_BUDGET_USD = "0.1";
    assert.equal(cap.aiSpendCapUsd(), 0.1);
    process.env.AI_SPEND_CAP_USD = "0.05";
    assert.equal(cap.aiSpendCapUsd(), 0.05);
  });

  it("prices calls from the catalog and treats unknown models as expensive", async () => {
    const cap = await import("./ai-spend-cap");
    assert.equal(cap.costUsd(NANO, 1_000_000, 1_000_000), 0.3);
    assert.equal(cap.costUsd(SUPER, 1_000_000, 1_000_000), 1.2);
    assert.equal(cap.costUsd("some/new-model", 1_000_000, 0), 1);
  });

  it("reserves the worst case, settles to real usage, and refuses once the cap would be passed", async () => {
    const cap = await import("./ai-spend-cap");
    process.env.AI_SPEND_CAP_USD = "0.001";
    // Worst case: 1,000 prompt + 1,024 completion on Super = 0.0003 + 0.0009216 = 0.0012216 > 0.001
    await assert.rejects(() => cap.reserveSpend(SUPER, 1000, 1024), cap.SpendCapError);
    assert.equal((await cap.aiSpendSnapshot()).spentUsd, 0, "a refused call reserves nothing");

    const r = await cap.reserveSpend(NANO, 1000, 1024); // 0.00006 + 0.00024576
    assert.ok(Math.abs(cap.lastKnownAiSpendUsd() - 0.00030576) < 1e-9);
    await cap.settleSpend(r, { promptTokens: 1000, completionTokens: 100 }); // 0.00006 + 0.000024
    assert.ok(Math.abs(cap.lastKnownAiSpendUsd() - 0.000084) < 1e-9);

    for (let i = 0; i < 20; i += 1) {
      try {
        const next = await cap.reserveSpend(NANO, 1000, 1024);
        await cap.settleSpend(next, null); // missing usage keeps the worst case
      } catch (error) {
        assert.ok(error instanceof cap.SpendCapError);
        assert.match(error.message, /spend cap/);
        break;
      }
    }
    const snap = await cap.aiSpendSnapshot();
    assert.ok(snap.spentUsd <= 0.001, `spent ${snap.spentUsd} must stay under the cap`);
  });

  it("refuses live calls on Vercel without a durable store unless ephemeral is allowed", async () => {
    const cap = await import("./ai-spend-cap");
    delete process.env.AI_SPEND_STORE;
    process.env.VERCEL = "1";
    process.env.AI_SPEND_FILE = path.join(dir, "vercel-spend.json");
    await assert.rejects(() => cap.reserveSpend(NANO, 10, 10), /durable spend store/);
    process.env.AI_SPEND_ALLOW_EPHEMERAL = "1";
    const r = await cap.reserveSpend(NANO, 10, 10);
    assert.equal(r.settled, false);
  });

  it("keeps the running total in Redis with INCRBYFLOAT (Vercel KV names work too)", async () => {
    const cap = await import("./ai-spend-cap");
    delete process.env.AI_SPEND_STORE;
    process.env.VERCEL = "1";
    process.env.KV_REST_API_URL = "https://kv.test";
    process.env.KV_REST_API_TOKEN = "test-token";
    const original = globalThis.fetch;
    let total = 0;
    const commands: unknown[] = [];
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as string[];
      commands.push(command);
      if (command[0] === "INCRBYFLOAT") total += Number(command[2]);
      return Response.json({ result: String(total) });
    }) as typeof fetch;
    try {
      assert.equal(cap.spendStoreKind(), "redis");
      const r = await cap.reserveSpend(NANO, 1000, 100);
      await cap.settleSpend(r, { promptTokens: 500, completionTokens: 50 });
      assert.deepEqual((commands[0] as string[]).slice(0, 2), ["INCRBYFLOAT", "ai-spend-cap:inbox-bodyguard:usd"]);
      assert.ok(Math.abs(total - cap.costUsd(NANO, 500, 50)) < 1e-9);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("nebiusChat under the cap (mocked fetch, no real key)", () => {
  it("sends max_tokens, records cost from usage, then falls back once the cap is hit", async () => {
    process.env.AI_SPEND_STORE = "memory";
    process.env.AI_SPEND_CAP_USD = "0.0002";
    process.env.DEMO_MODE = "false";
    process.env.LLM_ENABLED = "true";
    process.env.BODYGUARD_ALLOW_LIVE = "1";
    process.env.NEBIUS_API_KEY = "test-key-not-real";
    const cap = await import("./ai-spend-cap");
    cap.resetAiSpendForTests();
    const { nebiusChat, SpendCapReachedError } = await import("./nebius");
    const original = globalThis.fetch;
    const bodies: Record<string, unknown>[] = [];
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({
        model: NANO,
        choices: [{ message: { content: '{"verdict":"allow"}' } }],
        usage: { prompt_tokens: 400, completion_tokens: 20 },
      });
    }) as typeof fetch;
    try {
      const first = await nebiusChat({ model: NANO, system: "sys", user: "cap test one", maxTokens: 512, purpose: "guard" });
      assert.equal(first.cached, false);
      assert.equal(bodies[0].max_tokens, 512);
      assert.ok(Math.abs(cap.lastKnownAiSpendUsd() - cap.costUsd(NANO, 400, 20)) < 1e-9);
      // Next worst case (≈ prompt + 1,024 × $0.24/M ≈ $0.00025) would pass the $0.0002 cap.
      await assert.rejects(
        () => nebiusChat({ model: NANO, system: "sys", user: "cap test two", maxTokens: 1024, purpose: "guard" }),
        (error: unknown) => error instanceof SpendCapReachedError && /spend cap/.test(error.message),
      );
      assert.equal(bodies.length, 1, "no request is sent once the cap would be passed");
      process.env.AI_SPEND_CAP_USD = "0.00002";
      const { budgetStatus } = await import("./budget");
      const status = budgetStatus();
      assert.equal(status.hard, true);
      assert.equal(status.paused, true);
      assert.match(status.banner ?? "", /spend cap reached/i);
    } finally {
      globalThis.fetch = original;
    }
  });
});
