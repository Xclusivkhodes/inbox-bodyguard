import type { Metadata } from "next";
import { BriefScreen } from "@/components/habit-screens";

export const metadata: Metadata = {
  title: "Morning brief",
  description: "Five lines before the inbox: replies, deadlines, money, what the guard held, and what still needs approval.",
};

export default function BriefPage() {
  return <BriefScreen />;
}
