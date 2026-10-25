import type { Metadata } from "next";
import { MemoryScreen } from "@/components/memory-screen";
import { getMemory } from "@/lib/store";

export const metadata: Metadata = {
  title: "Memory",
  description: "Contacts, preferences, and threads Inbox Bodyguard keeps on this machine. You can edit or wipe them.",
};

export default async function MemoryPage() {
  const memory = await getMemory();
  return (
    <MemoryScreen
      initial={{
        principal: memory.principal,
        contacts: memory.contacts,
        preferences: memory.preferences,
        threads: memory.threads,
        events: memory.events,
      }}
    />
  );
}
