import { randomUUID } from "node:crypto";

import { budgetStatus, type BudgetStatus } from "./budget";
import { hydrateRemoteSpend } from "./spend-remote";
import { appMeta, PIPELINE_VERSION } from "./config";
import { getDb } from "./db";
import { principal, seededContacts, seededPreferences } from "./directory";
import { fixtures } from "./fixtures";
import { goalHit } from "./guard/policy";
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
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
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

function loadDecisions(sessionId: string): Map<string, ActionDecision[]> {
  const rows = plainRows<{ emailId: string; actionId: string; decision: "approved" | "denied"; note: string; createdAt: string }>(
    getDb()
      .prepare(
        `SELECT email_id AS emailId, action_id AS actionId, decision, note, created_at AS createdAt
         FROM action_log WHERE session_id = ? ORDER BY created_at ASC`,
      )
      .all(sessionId),
  );
  const grouped = new Map<string, ActionDecision[]>();
  for (const row of rows) {
    const list = grouped.get(row.emailId) ?? [];
    list.push({ actionId: row.actionId, decision: row.decision, note: row.note, createdAt: row.createdAt });
    grouped.set(row.emailId, list);
  }
  return grouped;
}

function sessionAllow(sessionId: string): Set<string> {
  if (!sessionId) return new Set();
  const rows = getDb().prepare("SELECT email FROM contacts WHERE session_id = ? AND source = 'you'").all(sessionId) as {
    email?: string;
  }[];
  return new Set(rows.map((row) => String(row.email ?? "").toLowerCase()).filter(Boolean));
}

/** A session contact can approve a send or forward that the shared fixture withheld, without rewriting the fixture. */
function promote(sessionId: string, email: EmailView): EmailView {
  if (!sessionId || email.assessment.guard.verdict === "quarantine" || email.assessment.guardDown) return email;
  const allow = sessionAllow(sessionId);
  if (allow.size === 0) return email;
  const promoted: EmailView["assessment"]["assistant"]["actions"] = [];
  const withheld = email.assessment.withheld.filter((action) => {
    if (action.type !== "send" && action.type !== "forward") return true;
    const to = action.to?.toLowerCase();
    if (!to || !allow.has(to)) return true;
    if (goalHit([action], email.attackerGoal)) return true;
    promoted.push({ ...action, needsApproval: true, risk: "external" });
    return false;
  });
  if (promoted.length === 0) return email;
  return {
    ...email,
    assessment: {
      ...email.assessment,
      withheld,
      assistant: { ...email.assessment.assistant, actions: [...email.assessment.assistant.actions, ...promoted] },
    },
  };
}

function hydrate(row: EmailRow, decisions: ActionDecision[], sessionId: string): EmailView {
  const email = JSON.parse(row.payload) as Fixture;
  const assessment = JSON.parse(row.assessment) as Assessment;
  return promote(sessionId, { ...email, assessment, decisions, scanMode: row.scan_mode });
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

function seedContacts(db: ReturnType<typeof getDb>): void {
  const contact = db.prepare(
    `INSERT INTO contacts (session_id, email, name, organization, trust, notes, source) VALUES ('', ?, ?, ?, ?, ?, 'directory')
     ON CONFLICT(session_id, email) DO NOTHING`,
  );
  for (const person of seededContacts) {
    contact.run(person.email, person.name, person.organization, person.trust, person.notes);
  }
}

function contactEmailList(db: ReturnType<typeof getDb>): string[] {
  const rows = db.prepare("SELECT email FROM contacts WHERE session_id = ''").all() as { email?: string }[];
  return rows.map((row) => String(row.email ?? "")).filter(Boolean);
}

async function seed(): Promise<void> {
  const db = getDb();
  seedContacts(db);
  const version = db.prepare("SELECT value FROM meta WHERE key = 'pipeline'").get() as { value?: string } | undefined;
  const count = db.prepare("SELECT COUNT(*) AS n FROM emails").get() as { n?: number } | undefined;
  if (version?.value === PIPELINE_VERSION && Number(count?.n ?? 0) > 0) {
    const rows = db.prepare("SELECT * FROM emails WHERE source = 'fixture'").all() as EmailRow[];
    for (const row of rows) warmDemoCache(JSON.parse(row.payload) as Fixture, JSON.parse(row.assessment) as Assessment);
    await hydrateRemoteSpend();
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

  const extras = contactEmailList(db);
  for (const email of inbox) {
    const assessment = await assessEmail(email, { live: false, extraRecipients: extras });
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

  const preference = db.prepare(
    `INSERT INTO preferences (session_id, key, value, updated_at) VALUES ('', ?, ?, ?)
     ON CONFLICT(session_id, key) DO NOTHING`,
  );
  const now = new Date().toISOString();
  for (const item of seededPreferences) preference.run(item.key, item.value, now);

  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('pipeline', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(PIPELINE_VERSION);
  await hydrateRemoteSpend();
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

export async function getInbox(sessionId = ""): Promise<{ meta: PublicMeta; emails: EmailView[]; counts: InboxCounts }> {
  await ensureReady();
  const rows = getDb().prepare("SELECT * FROM emails WHERE source != 'imap' ORDER BY received_at DESC").all() as EmailRow[];
  const decisions = loadDecisions(sessionId);
  const emails = rows.map((row) => hydrate(row, decisions.get(row.id) ?? [], sessionId));
  return { meta: { ...appMeta(), budget: budgetStatus() }, emails, counts: countsFor(emails) };
}

export async function getEmail(id: string, sessionId = ""): Promise<EmailView | null> {
  await ensureReady();
  const row = getDb().prepare("SELECT * FROM emails WHERE id = ?").get(id) as EmailRow | undefined;
  if (!row || row.source === "imap") return null;
  return hydrate(row, loadDecisions(sessionId).get(id) ?? [], sessionId);
}

export async function decide(
  emailId: string,
  actionId: string,
  decision: "approved" | "denied",
  sessionId = "",
): Promise<EmailView> {
  await ensureReady();
  const email = await getEmail(emailId, sessionId);
  if (!email) throw new HttpError("That email is not in this inbox.", 404);
  const known = [...email.assessment.assistant.actions, ...email.assessment.withheld];
  const action = known.find((item) => item.id === actionId);
  if (!action) throw new HttpError("That action is not on this email.", 404);
  const blocked = email.assessment.withheld.some((item) => item.id === actionId);
  if (decision === "approved" && (blocked || email.assessment.guardDown)) {
    throw new HttpError("Blocked before any action ran. Nothing was sent.", 409, "BAD_INPUT");
  }
  if (
    decision === "approved" &&
    email.assessment.guard.verdict === "quarantine" &&
    (action.risk === "external" || action.type === "send" || action.type === "forward")
  ) {
    throw new HttpError("Blocked before any action ran. Nothing was sent.", 409, "BAD_INPUT");
  }
  getDb()
    .prepare(
      `INSERT INTO action_log (id, email_id, action_id, decision, note, created_at, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      emailId,
      actionId,
      decision,
      "Recorded on this machine. No mail was transmitted.",
      new Date().toISOString(),
      sessionId,
    );
  const updated = await getEmail(emailId, sessionId);
  if (!updated) throw new HttpError("That email is not in this inbox.", 404);
  return updated;
}

export async function getMemory(sessionId = "") {
  await ensureReady();
  const db = getDb();
  const contactRows = plainRows<MemoryContact & { sessionId?: string }>(
    db
      .prepare(
        `SELECT session_id AS sessionId, email, name, organization, trust, notes, source FROM contacts
         WHERE session_id = '' OR session_id = ? ORDER BY name`,
      )
      .all(sessionId),
  );
  const contacts = new Map<string, MemoryContact>();
  for (const row of contactRows) {
    if (row.sessionId && row.sessionId !== sessionId) continue;
    const contact: MemoryContact = {
      email: row.email,
      name: row.name,
      organization: row.organization,
      trust: row.trust,
      notes: row.notes,
      source: row.source,
    };
    if (!contacts.has(contact.email) || row.sessionId === sessionId) contacts.set(contact.email, contact);
  }
  const preferenceRows = plainRows<MemoryPreference & { sessionId?: string }>(
    db
      .prepare(
        `SELECT session_id AS sessionId, key, value, updated_at AS updatedAt FROM preferences
         WHERE session_id = '' OR session_id = ? ORDER BY key`,
      )
      .all(sessionId),
  );
  const preferences = new Map<string, MemoryPreference>();
  for (const row of preferenceRows) {
    const { sessionId: rowSession, ...item } = row;
    if (!preferences.has(item.key) || rowSession === sessionId) preferences.set(item.key, item);
  }
  return {
    meta: { ...appMeta(), budget: budgetStatus() },
    principal,
    contacts: [...contacts.values()],
    preferences: [...preferences.values()],
    threads: plainRows<MemoryThread>(
      db.prepare("SELECT id, subject, summary, status, updated_at AS updatedAt FROM threads ORDER BY updated_at DESC").all(),
    ),
    events: plainRows<MemoryEvent>(
      db.prepare(
        "SELECT id, email_id AS emailId, kind, detail, status, created_at AS createdAt FROM memory_events WHERE email_id NOT LIKE 'imap-%' ORDER BY created_at DESC",
      ).all(),
    ),
  };
}

const CONTACT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function contactEmails(): Promise<string[]> {
  await ensureReady();
  return contactEmailList(getDb());
}

/** A person the user added. Letters cannot write this row. Directory addresses stay put. */
export async function addContact(
  input: { name: string; email: string; organization?: string },
  sessionId = "",
): Promise<void> {
  await ensureReady();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 80);
  const organization = (input.organization ?? "").trim().slice(0, 80);
  if (!name || email.length > 200 || !CONTACT_EMAIL.test(email)) {
    throw new HttpError("A contact needs a name and an email address.", 400);
  }
  const db = getDb();
  const directory = db.prepare("SELECT source FROM contacts WHERE session_id = '' AND email = ?").get(email) as
    | { source?: string }
    | undefined;
  if (directory && directory.source !== "you") {
    throw new HttpError("That address is already in the directory.", 409, "BAD_INPUT");
  }
  db.prepare(
    `INSERT INTO contacts (session_id, email, name, organization, trust, notes, source)
     VALUES (?, ?, ?, ?, 'known', ?, 'you')
     ON CONFLICT(session_id, email) DO UPDATE SET
       name = excluded.name,
       organization = excluded.organization,
       notes = excluded.notes`,
  ).run(sessionId, email, name, organization, "You added this. Not taken from a letter.");
}

export async function setPreference(key: string, value: string, sessionId = ""): Promise<void> {
  await ensureReady();
  const cleanKey = key.trim().slice(0, 80);
  const cleanValue = value.trim().slice(0, 2000);
  if (!cleanKey || !cleanValue) throw new HttpError("A preference needs a name and a value.", 400);
  getDb()
    .prepare(
      `INSERT INTO preferences (session_id, key, value, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(sessionId, cleanKey, cleanValue, new Date().toISOString());
}

/** Clears this session's decisions. Letters, other sessions, and IMAP rows stay. */
export async function resetDemo(sessionId = ""): Promise<void> {
  await ensureReady();
  getDb().prepare("DELETE FROM action_log WHERE session_id = ?").run(sessionId);
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
