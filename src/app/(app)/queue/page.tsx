import type { Metadata } from "next";
import { QueueScreen } from "@/components/habit-screens";

export const metadata: Metadata = {
  title: "Approval queue",
  description: "One tap to approve or decline a send, forward, or delete. Nothing is transmitted.",
};

export default function QueuePage() {
  return <QueueScreen />;
}
