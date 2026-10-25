import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "ib-nebius-"));
process.env.BODYGUARD_DB = path.join(dir, "t.db");
process.env.BODYGUARD_CACHE_PATH = path.join(dir, "cache.json");
process.env.DEMO_MODE = "true";
process.env.LLM_ENABLED = "false";
delete process.env.NEBIUS_API_KEY;
delete process.env.BODYGUARD_ALLOW_LIVE;

describe("token factory gate", () => {
  it("serves a pre-warmed prompt without fetch", async () => {
    const { closeDb } = await import("./db");
    closeDb();
    const { rememberChat } = await import("./llm-cache");
    const { nebiusChat } = await import("./nebius");
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      throw new Error("fetch");
    }) as typeof fetch;
    try {
      rememberChat(
        { model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", system: "sys", user: "hello cache", temperature: 0, maxTokens: 300 },
        '{"verdict":"allow"}',
      );
      const result = await nebiusChat({
        model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
        system: "sys",
        user: "hello cache",
        temperature: 0,
        maxTokens: 300,
        purpose: "guard",
      });
      assert.equal(result.cached, true);
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("refuses Ultra and a cache miss while the kill switch is off", async () => {
    const { nebiusChat } = await import("./nebius");
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      throw new Error("fetch");
    }) as typeof fetch;
    try {
      await assert.rejects(
        () => nebiusChat({ model: "nvidia/Nemotron-3-Ultra-550b-a55b", system: "s", user: "ultra-unique", purpose: "assistant" }),
        /Ultra/,
      );
      await assert.rejects(
        () => nebiusChat({ model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", system: "s", user: "miss-unique", purpose: "guard" }),
        /LLM_ENABLED|paused|Live/,
      );
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not fetch once the hard spend limit is reached", async () => {
    process.env.LLM_ENABLED = "true";
    process.env.DEMO_MODE = "false";
    process.env.BODYGUARD_ALLOW_LIVE = "1";
    process.env.NEBIUS_API_KEY = "test-key";
    process.env.SPEND_BUDGET_USD = "1";
    const { closeDb } = await import("./db");
    closeDb();
    const { recordSpend } = await import("./budget");
    const { nebiusChat } = await import("./nebius");
    recordSpend({
      model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
      promptTokens: 20_000_000,
      completionTokens: 1_000_000,
      estimated: true,
      purpose: "test",
    });
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      throw new Error("fetch");
    }) as typeof fetch;
    try {
      await assert.rejects(
        () =>
          nebiusChat({
            model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
            system: "s",
            user: "over-budget-unique",
            purpose: "assistant",
          }),
        /paused|Live AI/,
      );
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = original;
      process.env.LLM_ENABLED = "false";
      process.env.DEMO_MODE = "true";
      delete process.env.BODYGUARD_ALLOW_LIVE;
      delete process.env.NEBIUS_API_KEY;
    }
  });
});
