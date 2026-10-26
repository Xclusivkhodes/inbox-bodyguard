import { connection } from "next/server";
import { headers } from "next/headers";
import { AppFrame, type InboxPayload } from "@/components/app-frame";
import { verifySession } from "@/lib/session";
import { getInbox } from "@/lib/store";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection();
  let initial: InboxPayload | null = null;
  try {
    const sessionId = verifySession((await headers()).get("x-ib-session")) ?? "";
    initial = await getInbox(sessionId);
  } catch {
    initial = null;
  }
  return <AppFrame initial={initial}>{children}</AppFrame>;
}
