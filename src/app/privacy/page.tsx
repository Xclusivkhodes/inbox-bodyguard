import type { Metadata } from "next";
import { Marketing } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Inbox Bodyguard stores, and what the public demo never connects.",
};

export default function PrivacyPage() {
  return (
    <Marketing>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-[12px] font-medium tracking-[0.08em] text-[var(--text-tertiary)] uppercase">Privacy</p>
        <h1 className="ib-display mt-3 text-[40px] leading-[44px] tracking-[-0.02em] sm:text-[56px] sm:leading-[60px]">
          The sample inbox is fictional.
        </h1>
        <div className="mt-8 flex flex-col gap-6 text-[15px] leading-7 text-[var(--text-secondary)]">
          <p>
            Inbox Bodyguard ships with letters for Alex Rivera at Northline. Those people and companies are fixtures. The public demo does not connect Gmail, IMAP, or any other mailbox.
          </p>
          <p>
            Contacts, preferences, approvals, and the spend ledger live in a SQLite file on the machine running the API. Wiping the file, or using Reset in the sample inbox, restores the fixtures. An ephemeral host reseeds that file on boot unless you mount a disk.
          </p>
          <p>
            API keys stay on the server. The browser only talks to this app. Prompts and mailbox passwords are not written to logs. A live model call, if you opt in, sends the capped letter text to Nebius Token Factory. The demo does not make that call.
          </p>
          <p>
            Rate limits are counted in memory, per direct connection, unless you explicitly trust a proxy. They are not a profile of a person.
          </p>
        </div>
      </article>
    </Marketing>
  );
}
