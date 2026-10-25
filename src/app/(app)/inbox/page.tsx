import type { Metadata } from "next";
import { Suspense } from "react";
import { InboxClient } from "@/components/inbox-client";

export const metadata: Metadata = {
  title: "Inbox",
  description: "Alex Rivera's sample inbox. The guard blocks hidden instructions before a draft is offered.",
};

export default function InboxPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  return (
    <Suspense fallback={<div className="ib-skeleton m-4 h-24" />}>
      <InboxLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function InboxLoader({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  return <InboxClient filter={filter} />;
}
