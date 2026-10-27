import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "ib-review-"));
process.env.BODYGUARD_DB = path.join(dir, "t.db");
process.env.DEMO_MODE = "true";
process.env.LLM_ENABLED = "false";
delete process.env.NEBIUS_API_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.TURSO_DATABASE_URL;

describe("session and ledger", () => {
  it("rejects a tampered session and keeps two sessions apart", async () => {
    const { closeDb } = await import("./db");
    closeDb();
    const { mintSession, signSession, verifySession } = await import("./session");
    const minted = mintSession();
    assert.equal(verifySession(minted.token), minted.id);
    assert.equal(verifySession(`${minted.id}.not-the-signature`), null);
    assert.equal(verifySession(signSession("zz")), null);

    const store = await import("./store");
    await store.decide("po-1842", "po-1842-send", "approved", "a".repeat(32));
    const other = await store.getEmail("po-1842", "b".repeat(32));
    assert.equal(other?.decisions.length, 0);
    const own = await store.getEmail("po-1842", "a".repeat(32));
    assert.equal(own?.decisions.at(-1)?.decision, "approved");
    await store.resetDemo("a".repeat(32));
    assert.equal((await store.getEmail("po-1842", "a".repeat(32)))?.decisions.length, 0);
    assert.ok((await store.getInbox("b".repeat(32))).emails.length >= 10);
  });

  it("rejects unknown fields, a secret that does not match, and a public IMAP sync", async () => {
    const { adminOk, jsonError, readJson } = await import("./http");
    const { LimitError } = await import("./limits");
    const { actionBody, memoryBody } = await import("./request-schema");
    const { classifierOutput } = await import("./llm-schema");
    assert.equal(classifierOutput.safeParse({ verdict: "clear", extra: true }).success, false);

    const requestId = "123e4567-e89b-41d3-a456-426614174000";
    const limited = jsonError(new LimitError("Too many requests from this network."), new Request("http://localhost/api/actions", {
      headers: { "x-request-id": requestId },
    }));
    const body = (await limited.json()) as { error?: unknown; code?: string; requestId?: string };
    assert.equal(typeof body.error, "string");
    assert.equal(body.code, "RATE_LIMITED");
    assert.equal(body.requestId, requestId);
    assert.equal(limited.headers.get("x-request-id"), requestId);

    process.env.ADMIN_SECRET = "correct-secret";
    assert.equal(adminOk(new Request("http://localhost/api/admin/llm", { headers: { "x-admin-secret": "correct-secret" } })), true);
    assert.equal(adminOk(new Request("http://localhost/api/admin/llm", { headers: { "x-admin-secret": "correct-secreT" } })), false);
    assert.equal(adminOk(new Request("http://localhost/api/admin/llm", { headers: { "x-admin-secret": "x" } })), false);
    delete process.env.ADMIN_SECRET;

    const extra = new Request("http://localhost/api/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emailId: "po-1842", actionId: "po-1842-send", decision: "approved", extra: true }),
    });
    await assert.rejects(() => readJson(extra, actionBody), /not valid/);

    const bulky = new Request("http://localhost/api/memory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "tone", value: "x".repeat(20_000) }),
    });
    await assert.rejects(() => readJson(bulky, memoryBody, 16 * 1024), /too large/);

    const { GET } = await import("../app/api/healthz/route");
    const health = await GET(new Request("http://localhost/api/healthz"));
    const healthBody = (await health.json()) as Record<string, unknown>;
    assert.deepEqual(healthBody, { ok: true });
    assert.equal(Object.hasOwn(healthBody, "spentUsd"), false);

    const { imapFeatureEnabled } = await import("./config");
    process.env.PUBLIC_DEMO = "true";
    process.env.INBOX_SOURCE = "imap";
    process.env.ADMIN_SECRET = "secret";
    process.env.IMAP_HOST = "imap.example";
    process.env.IMAP_USER = "alex";
    process.env.IMAP_PASSWORD = "secret";
    assert.equal(imapFeatureEnabled(), false);
    process.env.PUBLIC_DEMO = "false";
    assert.equal(imapFeatureEnabled(), true);
  });
});
