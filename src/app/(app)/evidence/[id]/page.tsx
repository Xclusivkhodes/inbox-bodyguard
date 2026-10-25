import type { Metadata } from "next";
import { EvidenceScreen } from "@/components/evidence-screen";

export const metadata: Metadata = {
  title: "Evidence",
  description: "The timeline of checks on one letter, from hidden text to the approval gate.",
};

export default function EvidencePage() {
  return <EvidenceScreen />;
}
