import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

describe("sqlite migration", () => {
  it("adds session columns to a database created before sessions", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ib-migrate-"));
    const file = path.join(dir, "old.db");
    const old = new DatabaseSync(file);
    old.exec(`
      CREATE TABLE contacts (email TEXT PRIMARY KEY, name TEXT NOT NULL, organization TEXT NOT NULL, trust TEXT NOT NULL, notes TEXT NOT NULL);
      CREATE TABLE preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE action_log (
        id TEXT PRIMARY KEY,
        email_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        note TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO contacts (email, name, organization, trust, notes) VALUES ('nia@example.com', 'Nia', 'Northline', 'known', 'seed');
      INSERT INTO action_log (id, email_id, action_id, decision, note, created_at) VALUES ('1', 'po-1842', 'po-1842-send', 'approved', 'local', '2026-10-01');
    `);
    old.close();
    process.env.BODYGUARD_DB = file;
    const { closeDb, getDb } = await import("./db");
    closeDb();
    const db = getDb();
    const names = (table: string) =>
      (db.prepare(`PRAGMA table_info(${table})`).all() as { name?: string }[]).map((row) => String(row.name));
    assert.ok(names("contacts").includes("session_id"));
    assert.ok(names("preferences").includes("session_id"));
    assert.ok(names("action_log").includes("session_id"));
    const contact = db.prepare("SELECT session_id, email FROM contacts").get() as { email?: string; session_id?: string };
    assert.equal(contact.email, "nia@example.com");
    assert.equal(contact.session_id, "");
    const decision = db.prepare("SELECT session_id FROM action_log").get() as { session_id?: string };
    assert.equal(decision.session_id, "");
    closeDb();
  });
});
