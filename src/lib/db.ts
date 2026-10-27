import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as { bodyguardDb?: DatabaseSync; bodyguardDbPath?: string };

export function databasePath(): string {
  return process.env.BODYGUARD_DB || path.join(process.cwd(), "data", "bodyguard.db");
}

function columnNames(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name?: string }[];
  return rows.map((row) => String(row.name ?? ""));
}

function migrate(db: DatabaseSync): void {
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
      session_id TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      organization TEXT NOT NULL,
      trust TEXT NOT NULL,
      notes TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'directory',
      PRIMARY KEY (session_id, email)
    );
    CREATE TABLE IF NOT EXISTS preferences (
      session_id TEXT NOT NULL DEFAULT '',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, key)
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
      created_at TEXT NOT NULL,
      session_id TEXT NOT NULL DEFAULT ''
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
    CREATE TABLE IF NOT EXISTS llm_cache (
      key TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      from_reasoning INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      prewarmed INTEGER NOT NULL DEFAULT 0,
      last_used TEXT NOT NULL
    );
  `);

  if (columnNames(db, "contacts").length > 0 && !columnNames(db, "contacts").includes("session_id")) {
    const hadSource = columnNames(db, "contacts").includes("source");
    db.exec(`
      ALTER TABLE contacts RENAME TO contacts_v0;
      CREATE TABLE contacts (
        session_id TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        organization TEXT NOT NULL,
        trust TEXT NOT NULL,
        notes TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'directory',
        PRIMARY KEY (session_id, email)
      );
    `);
    if (hadSource) {
      db.exec(
        `INSERT INTO contacts (session_id, email, name, organization, trust, notes, source)
         SELECT '', email, name, organization, trust, notes, COALESCE(source, 'directory') FROM contacts_v0`,
      );
    } else {
      db.exec(
        `INSERT INTO contacts (session_id, email, name, organization, trust, notes, source)
         SELECT '', email, name, organization, trust, notes, 'directory' FROM contacts_v0`,
      );
    }
    db.exec("DROP TABLE contacts_v0");
  }
  if (columnNames(db, "preferences").length > 0 && !columnNames(db, "preferences").includes("session_id")) {
    db.exec(`
      ALTER TABLE preferences RENAME TO preferences_v0;
      CREATE TABLE preferences (
        session_id TEXT NOT NULL DEFAULT '',
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (session_id, key)
      );
      INSERT INTO preferences (session_id, key, value, updated_at)
      SELECT '', key, value, updated_at FROM preferences_v0;
      DROP TABLE preferences_v0;
    `);
  }
  if (columnNames(db, "action_log").length > 0 && !columnNames(db, "action_log").includes("session_id")) {
    db.exec("ALTER TABLE action_log ADD COLUMN session_id TEXT NOT NULL DEFAULT ''");
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_action_log_session ON action_log(session_id, email_id);
    CREATE INDEX IF NOT EXISTS idx_action_log_email ON action_log(email_id);
  `);
  const contactColumns = columnNames(db, "contacts");
  if (contactColumns.length > 0 && !contactColumns.includes("source")) {
    db.exec("ALTER TABLE contacts ADD COLUMN source TEXT NOT NULL DEFAULT 'directory'");
  }
  const spend = db.prepare("SELECT value FROM meta WHERE key = 'spend_usd'").get() as { value?: string } | undefined;
  if (!spend) {
    const sum = db.prepare("SELECT COALESCE(SUM(usd), 0) AS usd FROM spend_ledger").get() as { usd?: number } | undefined;
    db.prepare("INSERT INTO meta (key, value) VALUES ('spend_usd', ?)").run(String(sum?.usd ?? 0));
  }
  db.exec("PRAGMA user_version = 1");
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
  migrate(db);
  globalForDb.bodyguardDb = db;
  globalForDb.bodyguardDbPath = file;
  return db;
}

export function closeDb(): void {
  globalForDb.bodyguardDb?.close();
  globalForDb.bodyguardDb = undefined;
  globalForDb.bodyguardDbPath = undefined;
}
