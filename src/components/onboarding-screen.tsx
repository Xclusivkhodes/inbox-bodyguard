import Link from "next/link";

export function OnboardingScreen() {
  return (
    <div className="ib-scroll flex-1 px-5 py-6 lg:px-10">
      <div className="mx-auto max-w-2xl">
        <div className="ib-eyebrow">Rules</div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">The sample inbox is already connected</h1>
        <p className="mt-3 text-[15px] leading-6 text-[var(--text-secondary)]">
          This demo does not attach Gmail or any other mailbox. Alex Rivera&apos;s letters are fixtures on this machine. A public URL should stay that way.
        </p>
        <ol className="mt-6 flex flex-col gap-3 text-[14px] leading-6">
          <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">1. The guard reads each letter before the assistant.</li>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">2. It reads the tool call again. If that check throws, every action is denied.</li>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">3. Mail to another person waits for Alex. Approving records a local decision. Nothing is transmitted.</li>
        </ol>
        <p className="mt-6 text-[13px] leading-5 text-[var(--text-tertiary)]">
          To sync a mailbox yourself, run with INBOX_SOURCE=imap, IMAP credentials, and ADMIN_SECRET, then POST /api/inbox/sync with the header x-admin-secret. Leave that off on a shared URL.
        </p>
        <Link href="/inbox" className="ib-btn ib-btn-primary mt-6">Go to the sample inbox</Link>
      </div>
    </div>
  );
}
