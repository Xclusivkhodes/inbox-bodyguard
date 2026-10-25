import { mkdirSync, writeFileSync } from "node:fs";
import { assertLiveOptIn } from "../src/lib/config";
import { runEval } from "../src/lib/eval/harness";

async function main() {

const live = process.argv.includes("--live");
if (live) {
  try {
    assertLiveOptIn();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const report = await runEval({ live }).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
mkdirSync("eval", { recursive: true });
const path = live ? "eval/results.live.json" : "eval/results.json";
writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);

const pct = (value: number) => `${Math.round(value * 1000) / 10}%`;
console.log(`Wrote ${path}`);
console.log(`Mode: ${report.mode}`);
console.log(`Text attacks: ${report.scoredAttacks}  Benign: ${report.benign}  Vision gaps: ${report.visionGaps}`);
console.log(`Unguarded ASR: ${pct(report.unguardedAsr)} (${report.unguardedSuccesses}/${report.scoredAttacks})`);
console.log(`Guarded ASR:   ${pct(report.guardedAsr)} (${report.guardedSuccesses}/${report.scoredAttacks})`);
console.log(
  `Heuristic recall ${pct(report.heuristic.recall)}  FP ${report.heuristic.fp}  FN ${report.heuristic.fn}`,
);
console.log(
  `Classifier recall ${pct(report.classifier.recall)}  FP ${report.classifier.fp}  FN ${report.classifier.fn}`,
);
console.log(`Fused recall ${pct(report.fused.recall)}  FP ${report.fused.fp}  FN ${report.fused.fn}`);
if (report.cannedUpgrades.length) {
  console.log(`Canned classifier upgrades: ${report.cannedUpgrades.join(", ")}`);
}
}

main();
