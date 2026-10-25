"use client";

import type { EvalReport } from "@/lib/eval/harness";

type Confusion = EvalReport["heuristic"];

export function EvalScreen({ initial }: { initial: EvalReport }) {
  const report = initial;

  return (
    <div className="ib-scroll flex-1 px-5 py-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="ib-eyebrow">Red team</div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">Attack success, with and without the guard</h1>
        <p className="mt-3 text-[14px] leading-6 text-[var(--text-secondary)]">{report.note}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <figure className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <figcaption className="text-[12px] text-[var(--text-tertiary)]">Unguarded</figcaption>
            <div className="ib-mono mt-1 text-[32px]">{pct(report.unguardedAsr)}</div>
            <p className="text-[12px] text-[var(--text-secondary)]">{report.unguardedSuccesses} of {report.scoredAttacks} text attacks</p>
          </figure>
          <figure className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <figcaption className="text-[12px] text-[var(--text-tertiary)]">Guarded</figcaption>
            <div className="ib-mono mt-1 text-[32px]">{pct(report.guardedAsr)}</div>
            <p className="text-[12px] text-[var(--text-secondary)]">{report.guardedSuccesses} of {report.scoredAttacks} text attacks</p>
          </figure>
        </div>
        {report.layers ? (
          <table className="mt-6 w-full text-left text-[13px]">
            <caption className="mb-2 text-left text-[13px] font-medium">Attack success by layer</caption>
            <thead className="text-[var(--text-tertiary)]">
              <tr><th className="py-2 font-medium">Layer</th><th>Successes</th><th>Rate</th></tr>
            </thead>
            <tbody>
              {report.layers.map((layer) => (
                <tr key={layer.name} className="border-t border-[var(--border)]">
                  <td className="py-2">{layer.name}</td>
                  <td className="ib-mono">{layer.successes} / {report.scoredAttacks}</td>
                  <td className="ib-mono">{pct(layer.asr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <table className="mt-6 w-full text-left text-[13px]">
          <thead className="text-[var(--text-tertiary)]">
            <tr><th className="py-2 font-medium">Layer</th><th>Recall</th><th>False positives</th><th>Misses</th></tr>
          </thead>
          <tbody>
            <Row label="Heuristics" row={report.heuristic} />
            <Row label="Classifier" row={report.classifier} />
            <Row label="Fused" row={report.fused} />
          </tbody>
        </table>
        <p className="mt-4 text-[13px] leading-5 text-[var(--text-secondary)]">
          {report.benign} benign letters and {report.visionGaps} image-channel case sit beside the scored attacks. The image case is not in the attack-success rate. Canned classifier upgrades, not live Nemotron measurements: {report.cannedUpgrades.join(", ") || "none"}.
        </p>
        <p className="mt-3 text-[12px] text-[var(--text-tertiary)]">
          Guard {report.models.classifier}. Assistant {report.models.assistant}. This page does not call Token Factory.
        </p>
      </div>
    </div>
  );
}

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function Row({ label, row }: { label: string; row: Confusion }) {
  return (
    <tr className="border-t border-[var(--border)]">
      <td className="py-2">{label}</td>
      <td className="ib-mono">{pct(row.recall)}</td>
      <td className="ib-mono">{row.fp}</td>
      <td className="ib-mono">{row.fn}</td>
    </tr>
  );
}
