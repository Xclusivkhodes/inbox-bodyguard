import { randomUUID } from "node:crypto";

import { budgetStatus, type BudgetStatus } from "./budget";
import { appMeta, PIPELINE_VERSION } from "./config";
import { getDb } from "./db";
import { principal, seededContacts, seededPreferences } from "./directory";
import { fixtures } from "./fixtures";
import { assessEmail, warmDemoCache } from "./pipeline";
import type {
  ActionDecision,
  AppMeta,
  Assessment,
  EmailView,
  Fixture,
  MemoryContact,
  MemoryEvent,
  MemoryPreference,
  MemoryThread,
} from "./types";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export type InboxCounts = {
  inbox: number;
  pending: number;
  blocked: number;
  flagged: number;
  clear: number;
};

export type PublicMeta = AppMeta & { budget: BudgetStatus };

type EmailRow = {
  id: string;
  payload: string;
  assessment: string;
  source: string;
  scan_mode: "demo" | "live";
  received_at: string;
};

let ready: Promise<void> | null = null;

/** node:sqlite rows have a null prototype. Next.js refuses those as client props. */
function plainRows<T>(rows: unknown): T[] {
  return JSON.parse(JSON.stringify(rows)) as T[];
}

function hydrate(row: EmailRow): EmailView {
  const email = JSON.parse(row.payload) as Fixture;
  const assessment = JSON.parse(row.assessment) as Assessment;
  const decisions = plainRows<ActionDecision>(
    getDb()
      .prepare(
        `SELECT action_id AS actionId, decision, note, created_at AS createdAt
         FROM action_log WHERE email_id = ? ORDER BY created_at ASC`,
      )
      .all(row.id),
  );
  return { ...email, assessment, decisions, scanMode: row.scan_mode };
}

function countsFor(emails: EmailView[]): InboxCounts {
  return {
    inbox: emails.length,
    pending: emails.filter((email) =>
      email.assessment.assistant.actions.some(
        (action) => action.needsApproval && !email.decisions.some((decision) => decision.actionId === action.id),
      ),
    ).length,
    blocked: emails.filter((email) => email.assessment.guard.verdict === "quarantine").length,
    flagged: emails.filter((email) => email.assessment.guard.verdict === "sanitize").length,
    clear: emails.filter((email) => email.assessment.guard.verdict === "clear").length,
  };
}

async function seed(): Promise<void> {
  const db = getDb();
  const version = db.prepare("SELECT value FROM meta WHERE key = 'pipeline'").get() as { value?: string } | undefined;
  const count = db.prepare("SELECT COUNT(*) AS n FROM emails").get() as { n?: number } | undefined;
  if (version?.value === PIPELINE_VERSION && Number(count?.n ?? 0) > 0) {
    const rows = db.prepare("SELECT * FROM emails WHERE source = 'fixture'").all() as EmailRow[];
    for (const row of rows) warmDemoCache(JSON.parse(row.payload) as Fixture, JSON.parse(row.assessment) as Assessment);
    return;
  }

  const inbox = fixtures
    .filter((email) => email.inInbox)
    .slice()
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  const upsert = db.prepare(
    `INSERT INTO emails (id, payload, assessment, source, scan_mode, received_at)
     VALUES (?, ?, ?, 'fixture', 'demo', ?)
     ON CONFLICT(id) DO UPDATE SET
       payload = excluded.payload,
       assessment = excluded.assessment,
       source = 'fixture',
       scan_mode = 'demo',
       received_at = excluded.received_at
     WHERE emails.source = 'fixture'`,
  );
  const thread = db.prepare(
    `INSERT INTO threads (id, subject, summary, status, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET subject = excluded.subject, summary = excluded.summary, status = excluded.status, updated_at = excluded.updated_at`,
  );
  const memory = db.prepare(
    `INSERT INTO memory_events (id, email_id, kind, detail, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET detail = excluded.detail, status = excluded.status, created_at = excluded.created_at`,
  );

  for (const email of inbox) {
    const assessment = await assessEmail(email, { live: false });
    upsert.run(email.id, JSON.stringify(email), JSON.stringify(assessment), email.receivedAt);
    warmDemoCache(email, assessment);
    thread.run(
      email.threadId,
      email.subject,
      assessment.assistant.summary,
      assessment.guard.verdict,
      email.receivedAt,
    );
    memory.run(
      `mem-${email.id}`,
      email.id,
      assessment.guard.verdict === "quarantine" ? "injection" : "thread",
      assessment.guard.verdict === "quarantine"
        ? assessment.guard.explanation
        : assessment.assistant.summary,
      assessment.guard.verdict === "quarantine" ? "blocked" : "applied",
      email.receivedAt,
    );
  }

  const contact = db.prepare(
    `INSERT INTO contacts (email, name, organization, trust, notes) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO NOTHING`,
  );
  for (const person of seededContacts) {
    contact.run(person.email, person.name, person.organization, person.trust, person.notes);
  }
  const preference = db.prepare(
    `INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO NOTHING`,
  );
  const now = new Date().toISOString();
  for (const item of seededPreferences) preference.run(item.key, item.value, now);

  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('pipeline', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(PIPELINE_VERSION);
}

export function ensureReady(): Promise<void> {
  if (!ready) {
    ready = seed().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

export async function publicMeta(): Promise<PublicMeta> {
  await ensureReady();
  return { ...appMeta(), budget: budgetStatus() };
}

export async function getInbox(): Promise<{ meta: PublicMeta; emails: EmailView[]; counts: InboxCounts }> {
  await ensureReady();
  const rows = getDb().prepare("SELECT * FROM emails ORDER BY received_at DESC").all() as EmailRow[];
  const emails = rows.map(hydrate);
  return { meta: { ...appMeta(), budget: budgetStatus() }, emails, counts: countsFor(emails) };
}

export async function getEmail(id: string): Promise<EmailView | null> {
  await ensureReady();
  const row = getDb().prepare("SELECT * FROM emails WHERE id = ?").get(id) as EmailRow | undefined;
  return row ? hydrate(row) : null;
}

export async function decide(emailId: string, actionId: string, decision: "approved" | "denied"): Promise<EmailView> {
  await ensureReady();
  const email = await getEmail(emailId);
  if (!email) throw new HttpError("That email is not in this inbox.", 404);
  const known = [...email.assessment.assistant.actions, ...email.assessment.withheld];
  const action = known.find((item) => item.id === actionId);
  if (!action) throw new HttpError("That action is not on this email.", 404);
  const blocked = email.assessment.withheld.some((item) => item.id === actionId);
  if (decision === "approved" && (blocked || email.assessment.guardDown)) {
    throw new HttpError("Blocked before any action ran. Nothing was sent.", 409);
  }
  if (
    decision === "approved" &&
    email.assessment.guard.verdict === "quarantine" &&
    (action.risk === "external" || action.type === "send" || action.type === "forward")
  ) {
    throw new HttpError("Blocked before any action ran. Nothing was sent.", 409);
  }
  getDb()
    .prepare(
      `INSERT INTO action_log (id, email_id, action_id, decision, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      emailId,
      actionId,
      decision,
      "Recorded on this machine. No mail was transmitted.",
      new Date().toISOString(),
    );
  const updated = await getEmail(emailId);
  if (!updated) throw new HttpError("That email is not in this inbox.", 404);
  return updated;
}

export async function getMemory() {
  await ensureReady();
  const db = getDb();
  return {
    meta: { ...appMeta(), budget: budgetStatus() },
    principal,
    contacts: plainRows<MemoryContact>(
      db.prepare("SELECT email, name, organization, trust, notes FROM contacts ORDER BY name").all(),
    ),
    preferences: plainRows<MemoryPreference>(
      db.prepare("SELECT key, value, updated_at AS updatedAt FROM preferences ORDER BY key").all(),
    ),
    threads: plainRows<MemoryThread>(
      db.prepare("SELECT id, subject, summary, status, updated_at AS updatedAt FROM threads ORDER BY updated_at DESC").all(),
    ),
    events: plainRows<MemoryEvent>(
      db.prepare(
        "SELECT id, email_id AS emailId, kind, detail, status, created_at AS createdAt FROM memory_events ORDER BY created_at DESC",
      ).all(),
    ),
  };
}

export async function setPreference(key: string, value: string): Promise<void> {
  await ensureReady();
  const cleanKey = key.trim().slice(0, 80);
  const cleanValue = value.trim().slice(0, 2000);
  if (!cleanKey || !cleanValue) throw new HttpError("A preference needs a name and a value.", 400);
  getDb()
    .prepare(
      `INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(cleanKey, cleanValue, new Date().toISOString());
}

export async function resetDemo(): Promise<void> {
  const db = getDb();
  db.exec("DELETE FROM emails; DELETE FROM action_log; DELETE FROM memory_events; DELETE FROM threads;");
  db.prepare("DELETE FROM meta WHERE key = 'pipeline'").run();
  ready = null;
  await ensureReady();
}

export async function saveAssessment(
  email: Fixture,
  assessment: Assessment,
  scanMode: "demo" | "live",
  source = "fixture",
): Promise<void> {
  await ensureReady();
  getDb()
    .prepare(
      `INSERT INTO emails (id, payload, assessment, source, scan_mode, received_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         assessment = excluded.assessment,
         source = excluded.source,
         scan_mode = excluded.scan_mode`,
    )
    .run(email.id, JSON.stringify(email), JSON.stringify(assessment), source, scanMode, email.receivedAt);
}
