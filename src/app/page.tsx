import { Brain, Eye, Hand, Mail, Shield, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LandingDemo } from "@/components/landing-demo";
import { Marketing } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: { absolute: "Inbox Bodyguard" },
  description: "The AI email assistant that can't be turned against you.",
};

const lanes = [
  { lane: "guard", icon: Shield, title: "Guard", detail: "Nemotron Nano scans the letter, then the tool call." },
  { lane: "memory", icon: Brain, title: "Memory", detail: "SQLite on this machine. Contacts, rules, and threads." },
  { lane: "reason", icon: Sparkles, title: "Assistant", detail: "Nemotron Nano drafts. Super only if Nano is unsure." },
  { lane: "tool", icon: Mail, title: "Actions", detail: "Approval gate. Nothing is transmitted." },
];

export default function HomePage() {
  return (
    <Marketing>
      <div className="mx-auto grid max-w-[1280px] items-start gap-8 px-4 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_600px] lg:gap-16 lg:px-8 lg:pt-16">
        <section className="lg:pt-8">
          <p className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] pr-3 pl-1 text-[12px] text-[var(--text-secondary)]">
            <span className="inline-flex h-6 items-center rounded-full border border-[var(--accent-border)] px-2 text-[12px] font-medium text-[var(--accent)]">Demo</span>
            Prompt-injection guard, on every email
          </p>
          <h1 className="ib-display mt-6 text-[40px] leading-[44px] tracking-[-0.02em] sm:text-[56px] sm:leading-[60px] lg:text-[72px] lg:leading-[76px]">
            An AI assistant for your inbox, <em className="text-[var(--accent)]">with a bodyguard.</em>
          </h1>
          <p className="mt-6 max-w-[520px] text-[16px] leading-7 text-[var(--text-secondary)] sm:text-[17px] sm:leading-7">
            The AI email assistant that can&apos;t be turned against you. It remembers context and drafts replies. The guard reads every email first, and again before any tool runs.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/inbox" className="ib-btn ib-btn-primary ib-btn-lg">
              <Mail className="ib-icon" aria-hidden="true" />
              Open the sample inbox
            </Link>
            <Link href="/how" className="ib-btn ib-btn-secondary ib-btn-lg">How it works</Link>
          </div>
          <ul className="mt-8 flex flex-col gap-3 text-[13px] text-[var(--text-secondary)]">
            <li className="flex items-center gap-3"><Hand className="ib-icon text-[var(--accent)]" aria-hidden="true" />Nothing is sent without your approval</li>
            <li className="flex items-center gap-3"><Eye className="ib-icon text-[var(--accent)]" aria-hidden="true" />Every decision names the model and the reason</li>
            <li className="flex items-center gap-3"><Brain className="ib-icon text-[var(--accent)]" aria-hidden="true" />Memory you can read, edit, and wipe</li>
          </ul>
        </section>
        <LandingDemo />
      </div>
      <section id="how" className="mx-auto mt-16 max-w-[1280px] px-4 pb-16 sm:px-6 lg:px-8">
        <h2 className="text-[13px] font-medium tracking-[0.08em] text-[var(--text-tertiary)] uppercase">Four lanes</h2>
        <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
          {lanes.map((item) => (
            <div key={item.title} className="flex items-start gap-3 bg-[var(--surface)] p-4">
              <span
                className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: item.lane === "guard" ? "var(--model-guard)" : "var(--text-tertiary)" }}
                aria-hidden="true"
              />
              <item.icon className="ib-icon text-[var(--text-secondary)]" aria-hidden="true" />
              <div>
                <h3 className="text-[14px] font-medium">{item.title}</h3>
                <p className="mt-1 text-[12px] leading-5 text-[var(--text-tertiary)]">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 grid gap-3 lg:grid-cols-3">
          {[
            ["Hidden text", "Gmail's Gemini summary was hijacked by white-on-white instructions. Inbox Bodyguard pulls that text out and shows what it removed."],
            ["One filter is not enough", "Adaptive attacks beat a single classifier most of the time. A reader, a planner, and a tool gate sit in front of the model."],
            ["Assist, and stay personal", "Other assistants are costly or Gmail-only. Security tools flag mail, or they are enterprise-only. This is one inbox."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="text-[14px] font-medium">{title}</h3>
              <p className="mt-2 text-[13px] leading-5 text-[var(--text-secondary)]">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-[640px] text-[13px] leading-5 text-[var(--text-tertiary)]">
          The animation above is scripted example data. The sample inbox is a separate set of letters, assessed on this machine, with no call to Nebius Token Factory.
        </p>
      </section>
    </Marketing>
  );
}
