"use client";

import { useEffect, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("tone");
  const [value, setValue] = useState("");

  function load() {
    fetch(apiUrl("/api/memory"))
      .then(async (response) => {
        if (!response.ok) throw new Error("Memory could not be loaded.");
        return response.json() as Promise<MemoryPayload>;
      })
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Memory could not be loaded."));
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <div className="m-4 ib-banner px-4 py-3 text-[13px]">{error}</div>;
  if (!data) return <div className="ib-skeleton m-4 h-24" />;

  return (
    <div className="ib-scroll flex-1 px-5 py-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="ib-eyebrow">Memory</div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">What the assistant remembers</h1>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
          {data.principal.name}, {data.principal.title} at {data.principal.org}. Stored in SQLite on this machine, not in a model.
        </p>
        <section className="mt-8">
          <h2 className="text-[14px] font-semibold">Contacts</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.contacts.map((contact) => (
              <li key={contact.email} className="ib-memory">
                <b>{contact.name}</b>
                <span className="ib-mono">{contact.email}</span>
                <span className="ib-memory-src">{contact.trust} · directory, not from email</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-8">
          <h2 className="text-[14px] font-semibold">Preferences</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.preferences.map((item) => (
              <li key={item.key} className="rounded-lg border border-[var(--border)] px-4 py-3">
                <div className="ib-mono text-[11px] text-[var(--text-tertiary)]">{item.key} · you wrote this</div>
                <p className="mt-1 whitespace-pre-wrap text-[13px]">{item.value}</p>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={async (event) => {
              event.preventDefault();
              const response = await fetch(apiUrl("/api/memory"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value }),
              });
              if (!response.ok) {
                setError("That preference was not saved.");
                return;
              }
              setValue("");
              load();
            }}
          >
            <input className="ib-input sm:w-40" value={key} onChange={(event) => setKey(event.target.value)} aria-label="Preference name" />
            <input className="ib-input flex-1" value={value} onChange={(event) => setValue(event.target.value)} placeholder="New value" aria-label="Preference value" />
            <button className="ib-btn ib-btn-primary" type="submit">Save</button>
          </form>
        </section>
        <section className="mt-8">
          <h2 className="text-[14px] font-semibold">What was blocked from memory</h2>
          <ul className="mt-3 flex flex-col gap-2">
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
      </div>
    </div>
  );
}
