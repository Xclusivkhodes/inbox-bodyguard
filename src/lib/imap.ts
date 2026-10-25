import { principal } from "./directory";
import type { Fixture } from "./types";

/** Optional self-hosted mailbox. Never called on the public demo. */
export async function pullImap(): Promise<Fixture[]> {
  const host = process.env.IMAP_HOST?.trim();
  const user = process.env.IMAP_USER?.trim();
  const pass = process.env.IMAP_PASSWORD;
  if (!host || !user || !pass) throw new Error("IMAP is not configured.");

  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const client = new ImapFlow({
    host,
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE !== "0",
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  const out: Fixture[] = [];
  try {
    const status = await client.status("INBOX", { messages: true });
    const total = status ? (status.messages ?? 0) : 0;
    if (!total) return [];
    const from = Math.max(1, total - 19);
    for await (const message of client.fetch(`${from}:*`, { source: true, uid: true })) {
      if (!message.source) continue;
      const parsed = await simpleParser(message.source);
      const fromValue = parsed.from?.value?.[0];
      out.push({
        id: `imap-${message.uid}`,
        kind: "benign",
        channel: "text",
        inInbox: true,
        threadId: `imap-${message.uid}`,
        fromName: fromValue?.name || parsed.from?.text || "Unknown",
        fromEmail: fromValue?.address || "unknown@invalid",
        toEmail: principal.email,
        subject: parsed.subject || "(no subject)",
        text: (parsed.text || "").slice(0, 4000),
        html: typeof parsed.html === "string" ? parsed.html.slice(0, 8000) : undefined,
        receivedAt: (parsed.date ?? new Date()).toISOString(),
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return out;
}
