import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LimitError, assertIpLimit, clientIp, resetLimits, trackedAddresses, withLiveSlot } from "./limits";

describe("rate limit", () => {
  it("stops a sixth request in the same minute", () => {
    resetLimits();
    for (let i = 0; i < 5; i += 1) assertIpLimit("203.0.113.10");
    assert.throws(() => assertIpLimit("203.0.113.10"), LimitError);
    assertIpLimit("203.0.113.11");
  });

  it("uses the right-most forwarding hop only when the proxy is trusted", () => {
    const request = new Request("http://localhost/api/inbox", {
      headers: { "x-forwarded-for": "203.0.113.8, 198.51.100.4" },
    });
    delete process.env.TRUST_PROXY;
    assert.equal(clientIp(request), "direct");
    process.env.TRUST_PROXY = "1";
    assert.equal(clientIp(request), "198.51.100.4");
    const spoofed = new Request("http://localhost/api/inbox", {
      headers: { "x-forwarded-for": "not-an-ip" },
    });
    assert.equal(clientIp(spoofed), "direct");
    delete process.env.TRUST_PROXY;
  });

  it("drops idle addresses so the map cannot grow without bound", () => {
    resetLimits();
    for (let i = 0; i < 2100; i += 1) {
      const ip = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
      assertIpLimit(ip);
    }
    assert.ok(trackedAddresses() > 0);
    assert.ok(trackedAddresses() <= 2000);
  });

  it("rejects a fifth live slot instead of waiting without a bound", async () => {
    resetLimits();
    const release: Array<() => void> = [];
    const holders = Array.from({ length: 4 }, () =>
      withLiveSlot(() => new Promise<void>((resolve) => release.push(resolve))),
    );
    await new Promise((resolve) => setTimeout(resolve, 40));
    const started = Date.now();
    await assert.rejects(() => withLiveSlot(async () => "late"), LimitError);
    const waited = Date.now() - started;
    assert.ok(waited >= 1_500 && waited < 3_000);
    for (const done of release) done();
    await Promise.all(holders);
  });
});
