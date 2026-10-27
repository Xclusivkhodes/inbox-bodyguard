import type { Metadata } from "next";
import Link from "next/link";
import { Marketing } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Security",
  description: "What Inbox Bodyguard blocks, what it refuses to do, and where the guard fails closed.",
};

const points = [
  {
    title: "Untrusted mail stays data",
    body: "Instructions inside a letter are not instructions to the assistant. Hidden text, encoded payloads, lookalike senders, and tool-shaped JSON are treated as findings.",
  },
  {
    title: "Fail closed",
    body: "If the guard cannot finish, the letter is held and every tool is denied. A thrown output check does the same. Inbox Bodyguard does not guess and proceed.",
  },
  {
    title: "Spend has a brake",
    body: "Each live response records prompt and completion tokens, and the letter shows an estimate from the same rate table as the ledger. A demo trace says no call was made. Past 70% of the budget, only Nemotron Nano runs. Past 90%, or when LLM_ENABLED is off, calls stop and the cache or demo is served.",
  },
  {
    title: "Nothing is sent",
    body: "There is no mail transport. Approval writes a local decision. A public demo never attaches a real mailbox. IMAP sync requires an admin secret and stays off unless you run it yourself.",
  },
  {
    title: "Defence in depth",
    body: "Hidden text is removed, the letter is marked as data, Nemotron judges it, a reader and a planner stay apart, then a policy check, an exfiltration filter, and a masked re-execution run before any tool. One classifier is not the product. Nebius Token Factory has no dedicated guard model, so Nemotron Nano is the safety judge. The masked check in this demo does not make a second model call.",
  },
  {
    title: "Known limits",
    body: "The text guard does not read pictures. A polite memory poison and a mixed-script line can miss the rules; in the demo those two are canned judgments, not live measurements. A quoted teaching example is deliberately left alone.",
  },
];

export default function SecurityPage() {
  return (
    <Marketing>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-[12px] font-medium tracking-[0.08em] text-[var(--text-tertiary)] uppercase">Security</p>
        <h1 className="ib-display mt-3 text-[40px] leading-[44px] tracking-[-0.02em] sm:text-[56px] sm:leading-[60px]">
          The guard is allowed to refuse.
        </h1>
        <p className="mt-4 text-[16px] leading-7 text-[var(--text-secondary)]">
          Inbox Bodyguard does not claim to make an inbox safe. It shows what it blocked, what it withheld, and what it cannot see.
        </p>
        <ul className="mt-10 flex flex-col gap-4">
          {points.map((point) => (
            <li key={point.title} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.01em]">{point.title}</h2>
              <p className="mt-2 text-[14px] leading-6 text-[var(--text-secondary)]">{point.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-[14px]">
          <Link href="/eval" className="text-[var(--text-link)]">Read the red-team numbers</Link>
        </p>
      </article>
    </Marketing>
  );
}
