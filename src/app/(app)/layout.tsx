import { connection } from "next/server";
import { AppFrame, type InboxPayload } from "@/components/app-frame";
import { getInbox } from "@/lib/store";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection();
  let initial: InboxPayload | null = null;
  try {
    initial = await getInbox();
  } catch {
    initial = null;
  }
  return <AppFrame initial={initial}>{children}</AppFrame>;
}
