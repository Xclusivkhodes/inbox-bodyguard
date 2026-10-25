import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as { bodyguardDb?: DatabaseSync; bodyguardDbPath?: string };

export function databasePath(): string {
  return process.env.BODYGUARD_DB || path.join(process.cwd(), "data", "bodyguard.db");
}

export function getDb(): DatabaseSync {
  const file = databasePath();
  if (globalForDb.bodyguardDb && globalForDb.bodyguardDbPath === file) return globalForDb.bodyguardDb;
  if (globalForDb.bodyguardDb) {
    globalForDb.bodyguardDb.close();
    globalForDb.bodyguardDb = undefined;
  }
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      assessment TEXT NOT NULL,
      source TEXT NOT NULL,
      scan_mode TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contacts (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      organization TEXT NOT NULL,
      trust TEXT NOT NULL,
      notes TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memory_events (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      detail TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS action_log (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL,
      action_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS spend_ledger (
      id TEXT PRIMARY KEY,
      model TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL,
      completion_tokens INTEGER NOT NULL,
      usd REAL NOT NULL,
      estimated INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  globalForDb.bodyguardDb = db;
  globalForDb.bodyguardDbPath = file;
  return db;
}

export function closeDb(): void {
  globalForDb.bodyguardDb?.close();
  globalForDb.bodyguardDb = undefined;
  globalForDb.bodyguardDbPath = undefined;
}
