import type { Metadata } from "next";
import { EvalScreen } from "@/components/eval-screen";
import { runEval } from "@/lib/eval/harness";

export const metadata: Metadata = {
  title: "Red team",
  description: "Attack success with and without the guard, on the local demo suite. This page does not call Token Factory.",
};

export default async function EvalPage() {
  const report = await runEval({ live: false });
  return <EvalScreen initial={report} />;
}
