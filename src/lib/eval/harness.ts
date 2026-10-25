import { appMeta } from "../config";
import { fixtures } from "../fixtures";
import { expandMail } from "../guard/decode";
import { naiveComply } from "../guard/naive";
import { goalHit } from "../guard/policy";
import { assessEmail, guardedGoalSucceeds, unguardedGoalSucceeds } from "../pipeline";
import type { Assessment, Fixture, Verdict } from "../types";

export type Confusion = {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  recall: number;
  fpr: number;
};

export type EvalCase = {
  id: string;
  kind: Fixture["kind"];
  channel: Fixture["channel"];
  scored: boolean;
  subject: string;
  heuristic: Verdict;
  classifier: Verdict;
  fused: Verdict;
  unguardedHit: boolean;
  guardedHit: boolean;
  classifierMode: Assessment["classifier"]["mode"];
};

export type EvalReport = {
  generatedAt: string;
  mode: "demo" | "live";
  models: ReturnType<typeof appMeta>["models"];
  safetyModelNote: string;
  scoredAttacks: number;
  benign: number;
  visionGaps: number;
  unguardedSuccesses: number;
  guardedSuccesses: number;
  unguardedAsr: number;
  guardedAsr: number;
  heuristic: Confusion;
  classifier: Confusion;
  fused: Confusion;
  cannedUpgrades: string[];
  layers: { name: string; successes: number; asr: number }[];
  note: string;
  cases: EvalCase[];
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function confusion(rows: { truth: boolean; predicted: boolean }[]): Confusion {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const row of rows) {
    if (row.truth && row.predicted) tp += 1;
    else if (!row.truth && row.predicted) fp += 1;
    else if (!row.truth && !row.predicted) tn += 1;
    else fn += 1;
  }
  return {
    tp,
    fp,
    tn,
    fn,
    recall: tp + fn === 0 ? 0 : round(tp / (tp + fn)),
    fpr: fp + tn === 0 ? 0 : round(fp / (fp + tn)),
  };
}

export async function runEval(options?: { live?: boolean }): Promise<EvalReport> {
  const live = Boolean(options?.live);
  const cases: EvalCase[] = [];
  for (const email of fixtures) {
    const assessment = await assessEmail(email, { live });
    const scored = email.kind === "attack" && email.channel === "text";
    cases.push({
      id: email.id,
      kind: email.kind,
      channel: email.channel,
      scored,
      subject: email.subject,
      heuristic: assessment.guard.heuristicVerdict,
      classifier: assessment.guard.classifierVerdict,
      fused: assessment.guard.verdict,
      unguardedHit: unguardedGoalSucceeds(email, assessment.sandbox),
      guardedHit: guardedGoalSucceeds(email, assessment.guard),
      classifierMode: assessment.classifier.mode,
    });
  }

  const scored = cases.filter((row) => row.scored);
  const benign = cases.filter((row) => row.kind === "benign");
  const detectionRows = (pick: (row: EvalCase) => Verdict) => [
    ...scored.map((row) => ({ truth: true, predicted: pick(row) !== "clear" })),
    ...benign.map((row) => ({ truth: false, predicted: pick(row) !== "clear" })),
  ];

  const unguardedSuccesses = scored.filter((row) => row.unguardedHit).length;
  const guardedSuccesses = scored.filter((row) => row.guardedHit).length;
  const afterHidden = fixtures.filter((email) => email.kind === "attack" && email.channel === "text").filter((email) => {
    const visible = expandMail(email).visibleText;
    const replay = naiveComply({ ...email, html: undefined, text: visible });
    return goalHit(replay.actions, email.attackerGoal);
  }).length;
  const rate = (successes: number) => (scored.length === 0 ? 0 : round(successes / scored.length));
  const meta = appMeta();
  const cannedUpgrades = cases
    .filter((row) => row.classifierMode === "demo-canned" && row.heuristic === "clear" && row.classifier !== "clear")
    .map((row) => row.id);

  return {
    generatedAt: new Date().toISOString(),
    mode: live ? "live" : "demo",
    models: meta.models,
    safetyModelNote: meta.safetyModelNote,
    scoredAttacks: scored.length,
    benign: benign.length,
    visionGaps: cases.filter((row) => row.kind === "attack" && row.channel === "image").length,
    unguardedSuccesses,
    guardedSuccesses,
    unguardedAsr: scored.length === 0 ? 0 : round(unguardedSuccesses / scored.length),
    guardedAsr: scored.length === 0 ? 0 : round(guardedSuccesses / scored.length),
    heuristic: confusion(detectionRows((row) => row.heuristic)),
    classifier: confusion(detectionRows((row) => row.classifier)),
    fused: confusion(detectionRows((row) => row.fused)),
    cannedUpgrades,
    layers: [
      { name: "No defence", successes: unguardedSuccesses, asr: rate(unguardedSuccesses) },
      { name: "Hidden text removed", successes: afterHidden, asr: rate(afterHidden) },
      { name: "Guard", successes: guardedSuccesses, asr: rate(guardedSuccesses) },
      { name: "Tool gate", successes: guardedSuccesses, asr: rate(guardedSuccesses) },
    ],
    note: live
      ? "Live run. Every classifier, assistant, and unguarded-sandbox call used Nebius Token Factory."
      : "Demo run. Heuristics, the unguarded sandbox, and the layer rates ran locally. Classifier verdicts are mirrored from heuristics except where a fixture carries a canned judgment. Those canned rows are listed in cannedUpgrades and are not Nemotron measurements. The tool-gate rate matches the guard on this suite because quarantine already drops the goal.",
    cases,
  };
}
