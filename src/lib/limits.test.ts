import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LimitError, assertIpLimit, resetLimits } from "./limits";

describe("rate limit", () => {
  it("stops a sixth request in the same minute", () => {
    resetLimits();
    for (let i = 0; i < 5; i += 1) assertIpLimit("203.0.113.10");
    assert.throws(() => assertIpLimit("203.0.113.10"), LimitError);
    assertIpLimit("203.0.113.11");
  });
});
