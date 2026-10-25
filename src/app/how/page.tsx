import type { Metadata } from "next";
import Link from "next/link";
import { Marketing } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Inbox Bodyguard reads a letter, holds a tool call, and asks before anything leaves.",
};

const steps = [
  {
    title: "A letter arrives",
    body: "Inbox Bodyguard expands hidden HTML, comments, zero-width text, and encoded blobs, then runs high-precision rules. Nemotron Nano is called only when those rules cannot settle the letter.",
  },
  {
    title: "The guard decides",
    body: "Clear mail goes to the assistant. A sanitised letter keeps the human message and drops the payload. Quarantine holds the letter. If the guard cannot run, the letter is held and no tool runs.",
  },
  {
    title: "The assistant drafts",
    body: "A quarantined reader turns the letter into typed fields and cannot start a tool. The privileged planner sees only those fields and your request, never the raw mail. Nemotron Nano drafts. Super is used only when a live classifier is unsure and spend is under the soft limit. Ultra is not on the live path.",
  },
  {
    title: "A second gate, then you",
    body: "Before any tool runs, the guard reads the action again. External mail waits for approval. Approving records the decision on this machine. Inbox Bodyguard does not send mail.",
  },
];

export default function HowPage() {
  return (
    <Marketing>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-[12px] font-medium tracking-[0.08em] text-[var(--text-tertiary)] uppercase">How it works</p>
        <h1 className="ib-display mt-3 text-[40px] leading-[44px] tracking-[-0.02em] sm:text-[56px] sm:leading-[60px]">
          Two checks, then your approval.
        </h1>
        <p className="mt-4 text-[16px] leading-7 text-[var(--text-secondary)]">
          Inbox Bodyguard is an assistant with a guard in front of it. The guard runs on the way in, and again before a tool. The sample inbox shows the path with no live model call.
        </p>
        <ol className="mt-10 flex flex-col gap-4">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
              <div className="ib-mono text-[12px] text-[var(--text-tertiary)]">0{index + 1}</div>
              <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.01em]">{step.title}</h2>
              <p className="mt-2 text-[14px] leading-6 text-[var(--text-secondary)]">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/inbox" className="ib-btn ib-btn-primary">Open the sample inbox</Link>
          <Link href="/security" className="ib-btn ib-btn-secondary">Security</Link>
        </div>
      </article>
    </Marketing>
  );
}
