import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { databasePath } from "./db";

describe("database path", () => {
  it("uses /tmp on Vercel, data/ locally, and BODYGUARD_DB when set", () => {
    const saved = { db: process.env.BODYGUARD_DB, vercel: process.env.VERCEL };
    delete process.env.BODYGUARD_DB;
    delete process.env.VERCEL;
    assert.equal(databasePath(), path.join(process.cwd(), "data", "bodyguard.db"));
    process.env.VERCEL = "1";
    assert.equal(databasePath(), "/tmp/bodyguard.db");
    process.env.BODYGUARD_DB = "/tmp/custom.db";
    assert.equal(databasePath(), "/tmp/custom.db");
    if (saved.db === undefined) delete process.env.BODYGUARD_DB;
    else process.env.BODYGUARD_DB = saved.db;
    if (saved.vercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = saved.vercel;
  });
});
