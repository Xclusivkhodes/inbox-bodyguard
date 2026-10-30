"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import type { MemoryContact, MemoryEvent, MemoryPreference, MemoryThread } from "@/lib/types";

type MemoryPayload = {
  principal: { name: string; email: string; title: string; org: string };
  contacts: MemoryContact[];
  preferences: MemoryPreference[];
  threads: MemoryThread[];
  events: MemoryEvent[];
};

export function MemoryScreen({ initial }: { initial: MemoryPayload }) {
  const [data, setData] = useState<MemoryPayload | null>(initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState("tone");
  const [value, setValue] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactOrg, setContactOrg] = useState("");
  const valueRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLFormElement>(null);

  function load() {
    fetch(apiUrl("/api/memory"))
      .then(async (response) => {
        if (!response.ok) throw new Error("Memory could not be loaded.");
        return response.json() as Promise<MemoryPayload>;
      })
      .then((payload) => {
        setData(payload);
        setLoadError(null);
      })
      .catch((reason: unknown) => setLoadError(reason instanceof Error ? reason.message : "Memory could not be loaded."));
  }

  useEffect(() => {
    load();
  }, []);

  function beginEdit(item: MemoryPreference) {
    setKey(item.key);
    setValue(item.value);
    setFormError(null);
    editorRef.current?.scrollIntoView({ block: "nearest" });
    valueRef.current?.focus();
  }

  if (loadError) {
    return (
      <div className="m-4">
        <div className="ib-banner px-4 py-3 text-[13px]" role="alert">{loadError}</div>
        <button type="button" className="ib-btn ib-btn-secondary mt-3" onClick={() => { setLoadError(null); load(); }}>
          Try again
        </button>
      </div>
    );
  }
  if (!data) return <div className="ib-skeleton m-4 h-24" />;

  return (
    <div className="ib-scroll flex-1 px-5 py-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="ib-eyebrow">Memory</div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">What the assistant remembers</h1>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
          {data.principal.name}, {data.principal.title} at {data.principal.org}. Stored in SQLite on this machine, not in a model. A letter cannot write a contact or a preference.
        </p>
        <section className="mt-8">
          <h2 className="text-[14px] font-semibold">Contacts</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.contacts.length === 0 ? <li className="text-[13px] text-[var(--text-secondary)]">No contacts yet.</li> : null}
            {data.contacts.map((contact) => (
              <li key={contact.email} className="ib-memory">
                <b>{contact.name}</b>
                <span className="ib-mono">{contact.email}</span>
                <span className="ib-memory-src">
                  {contact.trust} · {contact.source === "you" ? "you added this" : "directory, not from email"}
                </span>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setFormError(null);
              const response = await fetch(apiUrl("/api/memory"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contact: { name: contactName, email: contactEmail, organization: contactOrg },
                }),
              });
              setSaving(false);
              if (!response.ok) {
                const body = (await response.json().catch(() => ({}))) as { error?: string };
                setFormError(body.error || "That contact was not saved.");
                return;
              }
              setContactName("");
              setContactEmail("");
              setContactOrg("");
              load();
            }}
          >
            <input className="ib-input sm:w-40" value={contactName} onChange={(event) => setContactName(event.target.value)} aria-label="Contact name" placeholder="Name" />
            <input className="ib-input sm:w-56" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} aria-label="Contact email" placeholder="name@example.com" inputMode="email" />
            <input className="ib-input w-full sm:w-auto sm:flex-1" value={contactOrg} onChange={(event) => setContactOrg(event.target.value)} aria-label="Organisation" placeholder="Organisation" />
            <button className="ib-btn ib-btn-secondary" type="submit" disabled={saving}>Add contact</button>
          </form>
        </section>
        <section className="mt-8">
          <h2 className="text-[14px] font-semibold">Preferences</h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Select a preference to edit that one fact.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {data.preferences.length === 0 ? <li className="text-[13px] text-[var(--text-secondary)]">No preferences yet. Add one below.</li> : null}
            {data.preferences.map((item) => (
              <li key={item.key}>
                <button type="button" className="ib-row-button" aria-label={`Edit preference ${item.key}`} onClick={() => beginEdit(item)}>
                  <div className="ib-mono text-[12px] text-[var(--text-tertiary)]">{item.key} · you wrote this</div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px]">{item.value}</p>
                </button>
              </li>
            ))}
          </ul>
          <form
            ref={editorRef}
            id="preference-editor"
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setFormError(null);
              const response = await fetch(apiUrl("/api/memory"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value }),
              });
              setSaving(false);
              if (!response.ok) {
                const body = (await response.json().catch(() => ({}))) as { error?: string };
                setFormError(body.error || "That preference was not saved.");
                return;
              }
              setValue("");
              load();
            }}
          >
            <input className="ib-input sm:w-40" value={key} onChange={(event) => setKey(event.target.value)} aria-label="Preference name" />
            <input ref={valueRef} className="ib-input w-full sm:w-auto sm:flex-1" value={value} onChange={(event) => setValue(event.target.value)} placeholder="New value" aria-label="Preference value" />
            <button className="ib-btn ib-btn-primary" type="submit" disabled={saving}>Save preference</button>
          </form>
        </section>
        <section className="mt-8">
          <h2 className="text-[14px] font-semibold">Threads</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.threads.length === 0 ? <li className="text-[13px] text-[var(--text-secondary)]">No threads yet.</li> : null}
            {data.threads.map((thread) => (
              <li key={thread.id} className="rounded-lg border border-[var(--border)] px-4 py-3">
                <div className="text-[13px] font-medium">{thread.subject}</div>
                <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">{thread.summary}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-8">
          <h2 className="text-[14px] font-semibold">What was blocked from memory</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.events.filter((item) => item.status === "blocked").length === 0 ? (
              <li className="text-[13px] text-[var(--text-secondary)]">Nothing from a letter was written into memory.</li>
            ) : null}
            {data.events.map((item) => (
              <li key={item.id} className="rounded-lg border border-[var(--border)] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[var(--text-tertiary)]">{item.kind}</span>
                  <span className={`ib-decision ${item.status === "blocked" ? "ib-decision--deny" : "ib-decision--allow"}`}>{item.status}</span>
                </div>
                <p className="mt-1 text-[13px] leading-5">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>
        {formError ? <p className="ib-banner mt-4 px-4 py-3 text-[13px]" role="alert">{formError}</p> : null}
      </div>
    </div>
  );
}
