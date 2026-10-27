import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatUsd, quoteLetter } from "./budget";

describe("letter cost", () => {
  it("says a demo scan made no call", () => {
    const cost = quoteLetter([], false);
    assert.equal(cost.usd, 0);
    assert.equal(cost.note, "No Token Factory call was made.");
  });

  it("prices a live Nano call from the catalog rates and ignores cache hits", () => {
    const cost = quoteLetter(
      [
        { model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", promptTokens: 1_000_000, completionTokens: 0, cached: false },
        { model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", promptTokens: 500, completionTokens: 100, cached: true },
      ],
      true,
    );
    assert.equal(cost.usd, 0.06);
    assert.equal(cost.calls, 1);
    assert.equal(cost.cached, 1);
    assert.match(cost.note, /Estimated \$0\.06 for 1 live call/);
    assert.match(cost.note, /served from cache/);
  });

  it("uses the Super rate and a zero-charge note when every call was cached", () => {
    const superCost = quoteLetter(
      [{ model: "nvidia/nemotron-3-super-120b-a12b", promptTokens: 1_000_000, completionTokens: 1_000_000, cached: false }],
      true,
    );
    assert.equal(superCost.usd, 1.2);
    assert.equal(formatUsd(0.000006), "$0.000006");
    const cached = quoteLetter(
      [{ model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", promptTokens: 10, completionTokens: 10, cached: true }],
      true,
    );
    assert.equal(cached.usd, 0);
    assert.match(cached.note, /No new Token Factory charge/);
  });
});
