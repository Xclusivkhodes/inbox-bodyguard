import type { Metadata } from "next";
import { GuardScreen } from "@/components/guard-screen";

export const metadata: Metadata = {
  title: "Guard result",
  description: "Why the guard blocked, flagged, or cleared a letter, and which tool calls were denied.",
};

export default function GuardPage() {
  return <GuardScreen />;
}
