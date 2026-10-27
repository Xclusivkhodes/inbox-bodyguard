"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/app-frame";
import { verdictLabel } from "@/lib/format";

export function GuardScreen() {
  const params = useParams<{ id: string }>();
  const { data } = useApp();
  const email = data?.emails.find((item) => item.id === params.id);
  if (!data) return null;
  if (!email) {
    return <div className="p-6 text-[14px]">That email is not in the sample inbox.</div>;
  }
  const guard = email.assessment.guard;
  const kind = guard.verdict === "quarantine" ? "blocked" : guard.verdict === "sanitize" ? "flagged" : "safe";
  return (
    <div className="ib-scroll flex-1 px-5 py-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="ib-eyebrow">Guard result</div>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">{email.subject}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`ib-tag ib-tag--${kind}`}><span className="dot" aria-hidden="true" />{verdictLabel(guard.verdict)}</span>
          <span className="ib-model ib-model--guard"><b>Guard</b><span className="ib-model-meta">{data.meta.models.classifier}</span></span>
          <span className="ib-model ib-model--tool"><b>Output gate</b><span className="ib-model-meta">{email.assessment.guardDown ? "fail closed" : "local rules"}</span></span>
        </div>
        <p className="mt-4 text-[15px] leading-6 text-[var(--text-secondary)]">{guard.explanation}</p>
        <p className="mt-3 text-[13px] text-[var(--text-secondary)]">{email.assessment.cost?.note ?? "No Token Factory call was made."}</p>
        <section className="mt-8">
          <h2 className="text-[14px] font-semibold">Why</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {guard.findings.length === 0 ? <li className="text-[13px] text-[var(--text-tertiary)]">No counting finding.</li> : null}
            {guard.findings.map((finding) => (
              <li key={finding.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium">{finding.title}</span>
                  <span className="ib-tag">{finding.severity}</span>
                </div>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{finding.detail}</p>
              </li>
            ))}
          </ul>
        </section>
        {email.assessment.withheld.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-[14px] font-semibold">Tool calls denied</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {email.assessment.withheld.map((action) => (
                <li key={action.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-4 py-3">
                  <div>
                    <div className="text-[13px] font-medium">{action.title}</div>
                    <div className="text-[12px] text-[var(--text-tertiary)]">{action.to || action.detail}</div>
                  </div>
                  <span className="ib-decision ib-decision--deny">Deny</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="mt-8 text-[13px] text-[var(--text-tertiary)]">
          The guard runs on the way in, and again before a tool. If it cannot run, the email is held. <Link className="text-[var(--text-link)]" href={`/evidence/${email.id}`}>See the timeline</Link>.
        </p>
      </div>
    </div>
  );
}
