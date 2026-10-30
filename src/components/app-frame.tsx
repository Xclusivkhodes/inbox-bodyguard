"use client";

import {
  BarChart3,
  BookOpen,
  Brain,
  CheckCheck,
  ListChecks,
  Sunrise,
  Inbox,
  Lock,
  Menu,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Waypoints,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Lockup } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiUrl } from "@/lib/api";
import type { AppMeta, EmailView } from "@/lib/types";

export type InboxPayload = {
  meta: AppMeta & {
    budget: {
      spentUsd: number;
      budgetUsd: number;
      paused: boolean;
      banner: string | null;
      nanoOnly: boolean;
      llmEnabled: boolean;
    };
  };
  emails: EmailView[];
  counts: { inbox: number; pending: number; blocked: number; flagged: number; clear: number };
};

type AppState = {
  data: InboxPayload | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  menu: boolean;
  setMenu: (open: boolean) => void;
  reading: boolean;
  setReading: (open: boolean) => void;
};

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp outside the inbox frame");
  return value;
}

export function AppFrame({ children, initial }: { children: React.ReactNode; initial?: InboxPayload | null }) {
  const pathname = usePathname();
  const [data, setData] = useState<InboxPayload | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);
  const [offline, setOffline] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reading, setReading] = useState(false);
  const hasData = useRef(Boolean(initial));

  function reload() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      setError("You are offline. Inbox Bodyguard kept the last letters it had. Nothing was sent.");
      setLoading(false);
      return;
    }
    if (!hasData.current) setLoading(true);
    fetch(apiUrl("/api/inbox"))
      .then(async (response) => {
        if (!response.ok) throw new Error("The inbox could not be loaded.");
        return response.json() as Promise<InboxPayload>;
      })
      .then((payload) => {
        hasData.current = true;
        setData(payload);
        setError(null);
        setOffline(false);
      })
      .catch(() => {
        setError("The inbox could not be loaded. Nothing was sent.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setOffline(true);
        return;
      }
      fetch(apiUrl("/api/inbox"))
        .then(async (response) => {
          if (!response.ok) throw new Error("load");
          return response.json() as Promise<InboxPayload>;
        })
        .then((payload) => {
          if (cancelled) return;
          hasData.current = true;
          setData(payload);
          setError(null);
          setOffline(false);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setLoading(false);
          setError("The inbox could not be loaded. Nothing was sent.");
        });
    };
    pull();
    const on = () => {
      setOffline(false);
      pull();
    };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      cancelled = true;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const value = useMemo(
    () => ({ data, error, loading, reload, menu, setMenu, reading, setReading }),
    [data, error, loading, menu, reading],
  );

  const counts = data?.counts;
  const blockedId = data?.emails.find((email) => email.assessment.guard.verdict === "quarantine")?.id ?? "inv-1842-poison";
  const nav = [
    { href: "/brief", label: "Morning brief", icon: Sunrise, current: pathname === "/brief" },
    { href: "/inbox", label: "Inbox", icon: Inbox, count: counts?.inbox, current: pathname === "/inbox" },
    { href: "/queue", label: "Approval queue", icon: ListChecks, count: counts?.pending, current: pathname === "/queue" },
    { href: "/report", label: "Weekly report", icon: BarChart3, current: pathname === "/report" },
    { href: `/guard/${blockedId}`, label: "Guard log", icon: ShieldAlert, count: counts?.blocked, current: pathname.startsWith("/guard") },
    { href: `/evidence/${blockedId}`, label: "Evidence", icon: Waypoints, current: pathname.startsWith("/evidence") },
    { href: "/memory", label: "Memory", icon: Brain, current: pathname === "/memory" },
    { href: "/onboarding", label: "Rules", icon: SlidersHorizontal, current: pathname === "/onboarding" },
    { href: "/eval", label: "Red team", icon: CheckCheck, current: pathname === "/eval" },
    { href: "/how", label: "How it works", icon: BookOpen, current: pathname === "/how" },
    { href: "/security", label: "Security", icon: Lock, current: pathname === "/security" },
    { href: "/privacy", label: "Privacy", icon: Shield, current: pathname === "/privacy" },
  ];

  return (
    <AppContext.Provider value={value}>
      <div className="ib-shell" data-reading={reading ? "true" : "false"}>
        <aside className="ib-sidebar" data-open={menu ? "true" : "false"}>
          <div className="flex h-12 items-center gap-2 px-3">
            <Lockup height={22} />
            <button type="button" className="ib-btn ib-btn-ghost ib-btn-sm ml-auto lg:hidden" onClick={() => setMenu(false)} aria-label="Close menu">
              <X className="ib-icon" />
            </button>
          </div>
          <div className="px-3">
            <Link href="/queue" className="ib-btn ib-btn-primary w-full justify-between" onClick={() => setMenu(false)}>
              <span className="flex items-center gap-2"><CheckCheck className="ib-icon" />Review drafts</span>
              <span className="ib-kbd">{counts?.pending ?? "–"}</span>
            </Link>
          </div>
          <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-3" aria-label="Inbox">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="ib-nav" aria-current={item.current ? "page" : undefined} onClick={() => setMenu(false)}>
                <item.icon className="ib-icon" />
                {item.label}
                {item.count != null ? <span className="ib-count">{item.count}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="mt-auto p-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="flex items-center gap-2 text-[12px] font-medium">
                <span className="h-2 w-2 rounded-full bg-[var(--guard-safe-solid)]" />
                Guard is on
                <span className="ib-mono ml-auto text-[10.5px] text-[var(--text-tertiary)]">Sample</span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1 text-center">
                <Stat label="clear" value={counts?.clear} tone="var(--guard-safe)" />
                <Stat label="flagged" value={counts?.flagged} tone="var(--guard-flagged)" />
                <Stat label="blocked" value={counts?.blocked} tone="var(--guard-blocked)" />
              </div>
              {data?.meta.budget.banner ? (
                <p className="mt-2 text-[12px] leading-4 text-[var(--text-secondary)]">{data.meta.budget.banner}</p>
              ) : (
                <p className="mt-2 text-[12px] leading-4 text-[var(--text-tertiary)]">
                  Demo mode. {data ? `$${data.meta.budget.spentUsd.toFixed(2)} of $${data.meta.budget.budgetUsd.toFixed(2)}` : "Loading spend"}
                </p>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2 px-1">
              <span className="ib-avatar" style={{ background: "#3f3f46" }}>AR</span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[13px] font-medium">Alex Rivera</div>
                <div className="truncate text-[12px] text-[var(--text-tertiary)]">alex@northline.io</div>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <a className="ib-skip" href="#main">Skip to content</a>
          <div className="flex h-12 items-center gap-2 border-b border-[var(--border)] px-3 lg:hidden">
            <button type="button" className="ib-btn ib-btn-ghost ib-btn-sm ib-btn-icon" onClick={() => setMenu(true)} aria-label="Open menu">
              <Menu className="ib-icon" />
            </button>
            <span className="text-[13px] font-medium">Inbox Bodyguard</span>
            {data?.meta.demoMode ? <span className="ib-tag ml-auto">Sample inbox</span> : null}
          </div>
          {offline ? (
            <div className="ib-status mx-4 mt-4 text-[13px]" role="status">
              You are offline. Inbox Bodyguard cannot refresh the sample inbox. Nothing was sent.
            </div>
          ) : null}
          {error && data ? (
            <div className="ib-status mx-4 mt-4 flex items-center justify-between gap-3 text-[13px]" role="alert">
              <span>{error}</span>
              <button type="button" className="ib-btn ib-btn-secondary ib-btn-sm" onClick={() => reload()}>Retry</button>
            </div>
          ) : null}
          {error && !data ? (
            <div className="m-4 max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6" role="alert">
              <h1 className="text-[18px] font-semibold">The inbox did not load</h1>
              <p className="mt-2 text-[14px] leading-6 text-[var(--text-secondary)]">{error}</p>
              <button type="button" className="ib-btn ib-btn-primary mt-4" onClick={() => reload()}>Retry</button>
            </div>
          ) : loading && !data ? <LoadingPane /> : <main id="main" className="flex min-h-0 flex-1 flex-col">{children}</main>}
        </div>
      </div>
    </AppContext.Provider>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone: string }) {
  return (
    <div className="rounded-md bg-[var(--surface-sunken)] py-1.5">
      <div className="ib-mono text-[13px] font-semibold" style={{ color: tone }}>{value ?? "–"}</div>
      <div className="text-[12px] text-[var(--text-tertiary)]">{label}</div>
    </div>
  );
}

function LoadingPane() {
  return (
    <div className="grid flex-1 gap-3 p-4">
      <div className="ib-skeleton h-8 w-40" />
      <div className="ib-skeleton h-16 w-full" />
      <div className="ib-skeleton h-16 w-full" />
      <div className="ib-skeleton h-16 w-2/3" />
    </div>
  );
}
