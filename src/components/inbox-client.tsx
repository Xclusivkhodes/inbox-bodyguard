"use client";

import { ArrowLeft, ShieldX, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-frame";
import { apiUrl } from "@/lib/api";
import { formatWhen, previewText, verdictLabel } from "@/lib/format";
import type { EmailView, ProposedAction, TraceStep } from "@/lib/types";

export function InboxClient({ filter, letter }: { filter?: string; letter?: string }) {
  const { data, setReading, reload } = useApp();
  const emails = data?.emails;
  const visible = useMemo(() => {
    const list = emails ?? [];
    if (filter === "approval") {
      return list.filter((email) =>
        email.assessment.assistant.actions.some(
          (action) => action.needsApproval && !email.decisions.some((decision) => decision.actionId === action.id),
        ),
      );
    }
    return list;
  }, [emails, filter]);
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(letter ?? null);
  const [seenLetter, setSeenLetter] = useState(letter);
  const [dismissedLetter, setDismissedLetter] = useState<string | null>(null);
  if (letter !== seenLetter) {
    setSeenLetter(letter);
    setPickedId(letter ?? null);
    setDismissedLetter(null);
  }
  const selectedId = pickedId ?? letter ?? "inv-1842-poison";
  const linked = Boolean(letter) && dismissedLetter !== letter;
  const queried = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return visible;
    return visible.filter((email) =>
      `${email.fromName} ${email.fromEmail} ${email.subject} ${email.assessment.assistant.summary}`.toLowerCase().includes(needle),
    );
  }, [visible, query]);
  const selected = queried.find((email) => email.id === selectedId) ?? null;

  if (!data) return null;

  return (
    <div className="ib-pane flex min-h-0 flex-1" data-reading={linked ? "true" : "false"}>
      <section className="ib-list">
        <div className="flex h-[52px] items-center justify-between gap-2 px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[14px] font-semibold">{filter === "approval" ? "Awaiting approval" : "Inbox"}</h1>
            <p className="truncate text-[12px] text-[var(--text-tertiary)]">Sample inbox · demo mode</p>
          </div>
          <button
            type="button"
            className="ib-btn ib-btn-ghost ib-btn-sm"
            onClick={async () => {
              const response = await fetch(apiUrl("/api/inbox/reset"), { method: "POST" });
              if (!response.ok) return;
              setQuery("");
              setPickedId("inv-1842-poison");
              setDismissedLetter(letter ?? null);
              reload();
            }}
          >
            Reset
          </button>
        </div>
        <div className="px-4 pb-3">
          <label className="sr-only" htmlFor="inbox-search">Search the sample inbox</label>
          <input
            id="inbox-search"
            className="ib-input"
            value={query}
            placeholder="Search letters"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="ib-scroll flex-1">
          {queried.length === 0 ? (
            <div className="px-4 py-10">
              <h2 className="text-[16px] font-semibold">{(emails?.length ?? 0) === 0 ? "The sample inbox is empty" : "No letters match"}</h2>
              <p className="mt-2 text-[13px] leading-5 text-[var(--text-secondary)]">
                {(emails?.length ?? 0) === 0
                  ? "Reset restores Alex Rivera's letters. Nothing was sent."
                  : "Try another name, or clear the search to see the test attack."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {query ? (
                  <button type="button" className="ib-btn ib-btn-secondary" onClick={() => setQuery("")}>Clear search</button>
                ) : null}
                <button
                  type="button"
                  className="ib-btn ib-btn-primary"
                  onClick={() => {
                    setQuery("");
                    setPickedId("inv-1842-poison");
                    setReading(true);
                  }}
                >
                  Show the test attack
                </button>
              </div>
            </div>
          ) : (
            queried.map((email) => (
              <button
                key={email.id}
                type="button"
                className="ib-row"
                aria-current={selected?.id === email.id ? "true" : undefined}
                onClick={() => {
                  setPickedId(email.id);
                  setReading(true);
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-medium">{email.fromName}</span>
                  <span className="ib-mono shrink-0 text-[11px] text-[var(--text-tertiary)]">{formatWhen(email.receivedAt)}</span>
                </div>
                <div className="mt-0.5 truncate text-[13px]">{email.subject}</div>
                <div className="mt-1 truncate text-[12px] text-[var(--text-tertiary)]">{previewText(email.assessment.assistant.summary || email.text)}</div>
                <div className="mt-2">
                  <VerdictChip verdict={email.assessment.guard.verdict} />
                </div>
              </button>
            ))
          )}
        </div>
      </section>
      {selected ? <Reading key={selected.id} email={selected} linked={linked} onBack={() => setDismissedLetter(letter ?? null)} onChanged={reload} /> : <EmptyRead hasMail={(emails?.length ?? 0) > 0} onShow={() => { setQuery(""); setPickedId("inv-1842-poison"); setReading(true); }} />}
    </div>
  );
}

function EmptyRead({ hasMail, onShow }: { hasMail: boolean; onShow: () => void }) {
  return (
    <div className="ib-read items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <h2 className="text-[16px] font-semibold">{hasMail ? "Select a letter." : "The sample inbox is empty."}</h2>
        <p className="mt-2 text-[13px] leading-5 text-[var(--text-tertiary)]">
          {hasMail ? "↑ ↓ to move, Enter to open." : "Reset the demo to load Alex's letters."}
        </p>
        <button type="button" className="ib-btn ib-btn-secondary mt-4" onClick={onShow}>Show the test attack</button>
      </div>
    </div>
  );
}

function Reading({
  email,
  linked,
  onBack,
  onChanged,
}: {
  email: EmailView;
  linked: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { setReading } = useApp();
  const [assist, setAssist] = useState(false);
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState(email.assessment.assistant.draft);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const guard = email.assessment.guard;
  const pending = email.assessment.assistant.actions.find(
    (action) => action.needsApproval && !email.decisions.some((decision) => decision.actionId === action.id),
  );

  useEffect(() => {
    const source = new EventSource(apiUrl(`/api/emails/${email.id}/events`));
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      setReady(true);
      source.close();
    };
    source.addEventListener("stage", (event) => {
      const step = JSON.parse((event as MessageEvent).data) as TraceStep;
      setSteps((current) => [...current, step]);
    });
    source.addEventListener("done", finish);
    source.onerror = () => finish();
    return () => {
      closed = true;
      source.close();
    };
  }, [email.id, email.assessment.assistant.draft]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && pending && ready) {
        event.preventDefault();
        void act(pending, "approved");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function act(action: ProposedAction, decision: "approved" | "denied") {
    setError(null);
    const response = await fetch(apiUrl("/api/actions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId: email.id, actionId: action.id, decision }),
    });
    const body = (await response.json()) as { error?: string; note?: string };
    if (!response.ok) {
      setError(body.error || "Nothing was sent.");
      return;
    }
    setNote(body.note || "Recorded on this machine. No mail was transmitted.");
    onChanged();
  }

  return (
    <>
      <article className="ib-read">
        <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <button
            type="button"
            className="ib-btn ib-btn-ghost ib-btn-sm ib-back"
            onClick={() => {
              setReading(false);
              if (linked) onBack();
            }}
            aria-label="Back to the list"
          >
            <ArrowLeft className="ib-icon" />
          </button>
          <div className="min-w-0">
            <h1 className="ib-h1 truncate">{email.subject}</h1>
            <p className="truncate text-[12px] text-[var(--text-tertiary)]">
              {email.fromName} &lt;{email.fromEmail}&gt; · {formatWhen(email.receivedAt)}
            </p>
          </div>
          <VerdictChip verdict={guard.verdict} />
          <button type="button" className="ib-btn ib-btn-ghost ib-btn-sm ml-auto xl:hidden" onClick={() => setAssist(true)}>
            <Sparkles className="ib-icon" />
            What happened
          </button>
        </header>
        <div className="ib-scroll flex-1 px-5 py-5">
          {guard.verdict === "quarantine" ? (
            <GuardBanner
              kind="blocked"
              title="Blocked before any action ran"
              body={
                hiddenExcerpt(guard)
                  ? `${guard.explanation} We removed hidden instructions.`
                  : guard.explanation
              }
              score={guard.score}
              evidence={hiddenExcerpt(guard)}
            />
          ) : null}
          {guard.verdict === "sanitize" ? (
            <GuardBanner
              kind="flagged"
              title="Flagged before a reply was offered"
              body="Readable, with the suspicious part removed. Actions stay off until you confirm."
              score={guard.score}
            />
          ) : null}
          {email.assessment.guardDown ? (
            <GuardBanner
              kind="blocked"
              title="Guard unavailable. Nothing was sent."
              body="The assistant is paused until the guard is back."
            />
          ) : null}
          <div className="whitespace-pre-wrap text-[14px] leading-[22px]">{guard.sanitizedText || email.text}</div>
          {guard.revealedText && guard.revealedText !== guard.sanitizedText ? (
            <div className="mt-4">
              <div className="ib-eyebrow mb-2">What the guard recovered</div>
              <p className="ib-reveal whitespace-pre-wrap text-[13px]">{guard.revealedText.slice(0, 700)}</p>
            </div>
          ) : null}
          {error ? <p className="mt-3 text-[12px] text-[var(--guard-blocked)]" role="alert">{error}</p> : null}
          {note || email.decisions.length > 0 ? (
            <p className="mt-4 text-[13px] text-[var(--text-secondary)]" role="status">
              Recorded on this machine. No mail was transmitted.
            </p>
          ) : null}
          {email.assessment.withheld.length > 0 ? (
            <div className="mt-6">
              <div className="ib-eyebrow mb-2">Denied before anything ran</div>
              <ul className="flex flex-col gap-2">
                {email.assessment.withheld.map((action) => (
                  <li key={action.id} className="flex items-start justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2">
                    <div>
                      <div className="text-[13px] font-medium">{action.title}</div>
                      <div className="text-[12px] text-[var(--text-tertiary)]">{action.to || action.detail}</div>
                    </div>
                    <span className="ib-decision ib-decision--deny">Deny</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2 text-[12px]">
            <Link className="text-[var(--text-link)]" href={`/guard/${email.id}`}>Guard result</Link>
            <Link className="text-[var(--text-link)]" href={`/evidence/${email.id}`}>Evidence</Link>
          </div>
        </div>
      </article>
      <Assistant
        email={email}
        steps={steps}
        ready={ready}
        open={assist}
        onClose={() => setAssist(false)}
        pending={pending}
        draft={draft}
        editing={editing}
        onDraft={setDraft}
        onEdit={() => setEditing((value) => !value)}
        onAct={(decision) => pending && act(pending, decision)}
        error={error}
      />
    </>
  );
}

function Assistant({
  email,
  steps,
  ready,
  open,
  onClose,
  pending,
  draft,
  editing,
  onDraft,
  onEdit,
  onAct,
  error,
}: {
  email: EmailView;
  steps: TraceStep[];
  ready: boolean;
  open: boolean;
  onClose: () => void;
  pending?: ProposedAction;
  draft: string;
  editing: boolean;
  onDraft: (value: string) => void;
  onEdit: () => void;
  onAct: (decision: "approved" | "denied") => void;
  error: string | null;
}) {
  const [scanNote, setScanNote] = useState<string | null>(null);
  return (
    <aside className="ib-assist" data-open={open ? "true" : "false"}>
      <div className="flex h-[52px] items-center justify-between px-4">
        <div className="text-[13px] font-medium">Assistant</div>
        <button type="button" className="ib-btn ib-btn-ghost ib-btn-sm xl:hidden" onClick={onClose}>Close</button>
      </div>
      <div className="ib-scroll flex-1 px-4 pb-4">
        {pending ? (
          <div className={`ib-action mb-3 ${pending.needsApproval ? "ib-action--pending" : ""}`}>
            <div className="ib-action-head">
              <Sparkles className="ib-icon" aria-hidden="true" />
              <span className="text-[13px] font-medium">{pending.title}</span>
              <span className="ib-tag ib-tag--pending ml-auto"><span className="dot" />Needs approval</span>
            </div>
            <div className="ib-action-body">
              {pending.to ? <p className="ib-mono mb-2">{pending.to}</p> : null}
              {editing ? (
                <textarea className="ib-textarea" value={draft} onChange={(event) => onDraft(event.target.value)} />
              ) : (
                <p className="whitespace-pre-wrap">{draft || pending.detail}</p>
              )}
            </div>
            <div className="ib-action-foot">
              <button type="button" className="ib-btn ib-btn-primary" disabled={!ready} onClick={() => onAct("approved")}>
                {pending.type === "delete" ? "Approve delete" : pending.type === "forward" ? "Approve forward" : "Approve & send"}
              </button>
              <button type="button" className="ib-btn ib-btn-ghost" onClick={onEdit}>Edit</button>
              <button type="button" className="ib-btn ib-btn-ghost" onClick={() => onAct("denied")}>Discard</button>
            </div>
          </div>
        ) : null}
        <p className="text-[13px] leading-5 text-[var(--text-secondary)]">{email.assessment.assistant.summary}</p>
        {error ? <p className="mt-2 text-[12px] text-[var(--guard-blocked)]" role="alert">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="ib-model ib-model--guard"><span className="ib-model-glyph" /><b>Guard</b><span className="ib-model-meta">Nano</span></span>
          <span className="ib-model ib-model--memory"><span className="ib-model-glyph" /><b>Memory</b><span className="ib-model-meta">SQLite</span></span>
          <span className="ib-model ib-model--reason"><span className="ib-model-glyph" /><b>Assistant</b><span className="ib-model-meta">Nano</span></span>
        </div>
        <ol className="mt-4 flex flex-col gap-3" aria-live="polite">
          {steps.map((step, index) => (
            <li key={`${step.stage}-${index}`} className="text-[12px] leading-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{step.stage}</span>
                {step.decision ? <span className={`ib-decision ib-decision--${step.decision === "held" ? "wait" : step.decision}`}>{step.decision}</span> : null}
              </div>
              <p className="text-[var(--text-tertiary)]">{step.summary}</p>
            </li>
          ))}
          {!ready ? <li className="ib-caret text-[12px] text-[var(--text-tertiary)]">Reading the trace</li> : null}
        </ol>
        <button
          type="button"
          className="ib-btn ib-btn-secondary mt-4 w-full"
          onClick={async () => {
            const response = await fetch(apiUrl(`/api/emails/${email.id}/scan`), { method: "POST" });
            const body = (await response.json()) as { error?: string };
            setScanNote(body.error || "Rescan finished from cache or a live call.");
          }}
        >
          Rescan with Nemotron
        </button>
        {scanNote ? <p className="mt-2 text-[12px] text-[var(--text-secondary)]">{scanNote}</p> : null}
      </div>
    </aside>
  );
}

function hiddenExcerpt(guard: EmailView["assessment"]["guard"]): string | null {
  const finding = guard.findings.find((item) =>
    ["hidden_text", "html_comment", "invisible_chars", "encoded_payload"].includes(item.category),
  );
  return finding?.excerpt || null;
}

function GuardBanner({
  kind,
  title,
  body,
  score,
  evidence,
}: {
  kind: "blocked" | "flagged";
  title: string;
  body: string;
  score?: number;
  evidence?: string | null;
}) {
  return (
    <div className={`ib-guard ib-guard--${kind} mb-4`} role="status">
      <ShieldX className="icon" aria-hidden="true" />
      <div className="ib-guard-title">{title}</div>
      {score != null ? <span className="ib-model ib-model--guard">guard · {score.toFixed(2)}</span> : null}
      <p className="ib-guard-body">{body}</p>
      {evidence ? (
        <div className="ib-evidence">
          <mark>{evidence}</mark>
        </div>
      ) : null}
    </div>
  );
}

function VerdictChip({ verdict }: { verdict: string }) {
  const kind = verdict === "quarantine" ? "blocked" : verdict === "sanitize" ? "flagged" : "safe";
  return (
    <span className={`ib-tag ib-tag--${kind}`}>
      <span className="dot" aria-hidden="true" />
      {verdictLabel(verdict)}
    </span>
  );
}
