"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app-frame";
import { apiUrl } from "@/lib/api";
import { followUps, morningBrief, weeklyReport, GATED_TYPES } from "@/lib/habit";
import type { EmailView, ProposedAction } from "@/lib/types";

export function BriefScreen() {
  const { data } = useApp();
  if (!data) return null;
  const lines = morningBrief(data.emails);
  return (
    <div className="ib-scroll flex-1 px-5 py-6 lg:px-10">
      <article className="mx-auto max-w-3xl">
        <p className="ib-eyebrow">Morning brief</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">Five lines before the inbox</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-6 text-[var(--text-secondary)]">
          Inbox Bodyguard opens on what needs you, what is due, and what the guard already held. The sample is Alex Rivera&apos;s inbox. Nothing was sent.
        </p>
        <section className="mt-8">
          <h2 className="text-[16px] font-semibold">Follow-ups</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {followUps(data.emails).length === 0 ? (
              <li className="text-[14px] text-[var(--text-secondary)]">No one has gone quiet for three days.</li>
            ) : (
              followUps(data.emails).map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <p className="text-[14px] font-medium">{item.who} has been waiting {item.days} days</p>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{item.subject}</p>
                  <Link href={`/inbox?letter=${item.id}`} className="ib-tap-link mt-2 inline-flex items-center text-[13px] font-medium text-[var(--text-link)]">Open the letter</Link>
                </li>
              ))
            )}
          </ul>
        </section>
        <ol className="mt-8 flex flex-col gap-3">
          {lines.map((line, index) => (
            <li key={line.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="ib-mono text-[12px] text-[var(--text-tertiary)]">0{index + 1}</div>
              <h2 className="mt-1 text-[16px] font-semibold">{line.label}</h2>
              <p className="mt-1 text-[14px] leading-6 text-[var(--text-secondary)]">{line.detail}</p>
              {line.href ? (
                <Link href={line.href} className="ib-tap-link mt-3 inline-flex items-center text-[13px] font-medium text-[var(--text-link)]">
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}

export function QueueScreen() {
  const { data, reload } = useApp();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;
  const pending: { email: EmailView; action: ProposedAction }[] = [];
  const denied: { email: EmailView; action: ProposedAction }[] = [];
  for (const email of data.emails) {
    for (const action of email.assessment.assistant.actions) {
      if (!GATED_TYPES.has(action.type)) continue;
      if (email.decisions.some((decision) => decision.actionId === action.id)) continue;
      pending.push({ email, action });
    }
    for (const action of email.assessment.withheld) {
      if (GATED_TYPES.has(action.type) || action.type === "exfiltrate") denied.push({ email, action });
    }
  }

  async function decide(emailId: string, actionId: string, decision: "approved" | "denied") {
    setError(null);
    const response = await fetch(apiUrl("/api/actions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId, actionId, decision }),
    });
    const body = (await response.json()) as { error?: string; note?: string };
    if (!response.ok) {
      setError(body.error || "Nothing was sent.");
      return;
    }
    setNote(body.note || "Recorded on this machine. No mail was transmitted.");
    reload();
  }

  return (
    <div className="ib-scroll flex-1 px-5 py-6 lg:px-10">
      <article className="mx-auto max-w-3xl">
        <p className="ib-eyebrow">Approval queue</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">One tap. Nothing is transmitted.</h1>
        <p className="mt-2 text-[14px] leading-6 text-[var(--text-secondary)]">
          Every send, forward, and delete waits here. Approving writes a decision on this machine. Inbox Bodyguard has no mail transport.
        </p>
        {note ? <p className="ib-status mt-4 text-[13px]" role="status">{note}</p> : null}
        {error ? <p className="ib-banner mt-4 px-4 py-3 text-[13px]" role="alert">{error}</p> : null}
        <ul className="mt-6 flex flex-col gap-3">
          {pending.length === 0 ? (
            <li className="text-[14px] text-[var(--text-secondary)]">
              Nothing waiting for you. Sends, forwards and deletes will appear here first.
            </li>
          ) : (
            pending.map(({ email, action }) => (
              <li key={action.id} className="ib-action ib-action--pending">
                <div className="ib-action-head">
                  <span className="ib-tag ib-tag--pending"><span className="dot" aria-hidden="true" />{action.type}</span>
                  <h2 className="text-[13px] font-medium">{action.title}</h2>
                </div>
                <div className="ib-action-body">
                  <p>{email.subject}</p>
                  <p className="mt-1">{action.detail}</p>
                  {action.to ? <p className="ib-mono mt-2">{action.to}</p> : null}
                </div>
                <div className="ib-action-foot">
                  <button type="button" className="ib-btn ib-btn-primary" onClick={() => decide(email.id, action.id, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="ib-btn ib-btn-ghost" onClick={() => decide(email.id, action.id, "denied")}>
                    Discard
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
        <h2 className="mt-10 text-[16px] font-semibold">Not in the queue</h2>
        <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
          The guard denied these before a tap was possible. They are not approvable.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {denied.slice(0, 8).map(({ email, action }) => (
            <li key={`${email.id}-${action.id}`} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
              <div>
                <div className="text-[13px] font-medium">{action.title}</div>
                <div className="text-[12px] text-[var(--text-tertiary)]">{email.subject}</div>
              </div>
              <span className="ib-decision ib-decision--deny">Deny</span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

export function ReportScreen() {
  const { data } = useApp();
  if (!data) return null;
  const report = weeklyReport(data.emails);
  return (
    <div className="ib-scroll flex-1 px-5 py-6 lg:px-10">
      <article className="mx-auto max-w-3xl">
        <p className="ib-eyebrow">This week</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">What the guard blocked</h1>
        <p className="mt-2 text-[14px] leading-6 text-[var(--text-secondary)]">
          A quiet ledger, not a notification. Counts are from the sample inbox on this machine.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {report.buckets.map((bucket) => (
            <li key={bucket.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-[13px] text-[var(--text-tertiary)]">{bucket.label}</div>
              <div className="ib-mono mt-1 text-[32px]">{bucket.count}</div>
            </li>
          ))}
        </ul>
        <h2 className="mt-8 text-[16px] font-semibold">Why each one was held or flagged</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {report.explained.map((item) => (
            <li key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <Link href={`/guard/${item.id}`} className="text-[14px] font-medium text-[var(--text-link)]">
                {item.subject}
              </Link>
              <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">{item.why}</p>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
