import type { Metadata } from "next";
import Link from "next/link";
import { Marketing } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That address is not a screen in Inbox Bodyguard.",
};

export default function NotFound() {
  return (
    <Marketing>
      <article className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:py-24">
        <p className="text-[12px] font-medium tracking-[0.08em] text-[var(--text-tertiary)] uppercase">404</p>
        <h1 className="ib-display mt-3 text-[40px] leading-[44px] tracking-[-0.02em]">This page is not in Inbox Bodyguard.</h1>
        <p className="mt-4 text-[15px] leading-7 text-[var(--text-secondary)]">
          The address does not match a screen. Nothing was sent.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="ib-btn ib-btn-primary">Back to the start</Link>
          <Link href="/inbox" className="ib-btn ib-btn-secondary">Open the sample inbox</Link>
        </div>
      </article>
    </Marketing>
  );
}
