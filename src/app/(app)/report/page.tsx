import type { Metadata } from "next";
import { ReportScreen } from "@/components/habit-screens";

export const metadata: Metadata = {
  title: "Weekly report",
  description: "What the guard blocked this week in the sample inbox.",
};

export default function ReportPage() {
  return <ReportScreen />;
}