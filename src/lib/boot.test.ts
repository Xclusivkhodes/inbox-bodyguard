import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("boot env", () => {
  it("leaves demo mode alone and refuses a half-configured live process", async () => {
    delete process.env.DEMO_MODE;
    delete process.env.LLM_ENABLED;
    delete process.env.NEBIUS_API_KEY;
    delete process.env.BODYGUARD_ALLOW_LIVE;
    delete process.env.NEBIUS_GUARD_MODEL;
    const { assertBootEnv } = await import("./boot");
    assert.doesNotThrow(() => assertBootEnv());

    process.env.DEMO_MODE = "false";
    process.env.LLM_ENABLED = "true";
    assert.throws(() => assertBootEnv(), /misconfigured/);

    process.env.NEBIUS_API_KEY = "test-key";
    process.env.BODYGUARD_ALLOW_LIVE = "1";
    process.env.NEBIUS_GUARD_MODEL = "nvidia/nemotron-3-super-120b-a12b";
    assert.throws(() => assertBootEnv(), /Super or Ultra/);

    delete process.env.NEBIUS_GUARD_MODEL;
    assert.doesNotThrow(() => assertBootEnv());
  });
});
