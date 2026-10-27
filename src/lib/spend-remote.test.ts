import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.UPSTASH_REDIS_REST_URL = "https://upstash.test";
process.env.UPSTASH_REDIS_REST_TOKEN = "token";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
process.env.DEMO_MODE = "true";
process.env.LLM_ENABLED = "false";

describe("remote spend", () => {
  it("increments Upstash with INCRBYFLOAT and fails closed when the store is down", async () => {
    const remote = await import("./spend-remote");
    const { budgetStatus } = await import("./budget");
    assert.equal(remote.spendBackend(), "upstash");
    const original = globalThis.fetch;
    let command: unknown;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      command = JSON.parse(String(init?.body ?? "null"));
      return Response.json({ result: "1.25" });
    }) as typeof fetch;
    try {
      await remote.addRemoteSpend(0.25);
      assert.deepEqual(command, ["INCRBYFLOAT", "inbox-bodyguard:spend_usd", "0.25"]);
      globalThis.fetch = (async () => {
        throw new Error("down");
      }) as typeof fetch;
      await remote.hydrateRemoteSpend();
      const status = budgetStatus();
      assert.equal(status.ledgerOk, false);
      assert.equal(status.paused, true);
      assert.equal(status.hard, true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
