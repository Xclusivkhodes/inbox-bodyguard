"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/how", label: "How it works" },
  { href: "/security", label: "Security" },
  { href: "/privacy", label: "Privacy" },
  { href: "/eval", label: "Red team" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Mark size={28} />
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">Inbox Bodyguard</span>
        </Link>
        <nav className="ml-6 hidden items-center gap-1 text-[13px] text-[var(--text-secondary)] md:flex" aria-label="Primary">
          {links.map((link) => (
            <Link key={link.href} className="rounded-md px-3 py-2 hover:text-[var(--text)]" href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href="/inbox" className="ib-btn ib-btn-primary hidden sm:inline-flex">
            Open the sample inbox
          </Link>
          <button
            type="button"
            className="ib-btn ib-btn-ghost ib-btn-sm md:hidden"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="ib-icon" /> : <Menu className="ib-icon" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="site-menu" className="border-t border-[var(--border)] px-4 py-3 md:hidden" aria-label="Mobile">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link className="ib-nav" href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link className="ib-btn ib-btn-primary w-full" href="/inbox" onClick={() => setOpen(false)}>
                Open the sample inbox
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-8 text-[13px] text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>Inbox Bodyguard. Sample mail stays on this machine. Nothing is transmitted.</p>
        <nav className="flex flex-wrap gap-4" aria-label="Footer">
          <Link href="/how" className="hover:text-[var(--text)]">How it works</Link>
          <Link href="/security" className="hover:text-[var(--text)]">Security</Link>
          <Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}

export function Marketing({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <a className="ib-skip" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
