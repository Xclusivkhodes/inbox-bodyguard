import type { Metadata } from "next";
import { OnboardingScreen } from "@/components/onboarding-screen";

export const metadata: Metadata = {
  title: "Rules",
  description: "What Inbox Bodyguard is allowed to do, and what always waits for Alex.",
};

export default function OnboardingPage() {
  return <OnboardingScreen />;
}
