"use client";

import { useParams } from "next/navigation";
import { useApp } from "@/components/app-frame";

export function EvidenceScreen() {
  const params = useParams<{ id: string }>();
  const { data } = useApp();
  const email = data?.emails.find((item) => item.id === params.id);
  if (!data) return null;
  if (!email) return <div className="p-6 text-[14px]">That email is not in the sample inbox.</div>;
  const max = Math.max(1, ...email.assessment.trace.map((step) => step.ms));
  return (
    <div className="ib-scroll flex-1 px-5 py-6 lg:px-10">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_240px]">
        <div>
          <div className="ib-eyebrow">Evidence</div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">Which model did what</h1>
          <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{email.subject}</p>
          <ol className="ib-timeline mt-8 flex flex-col gap-6">
            {email.assessment.trace.map((step, index) => (
              <li key={`${step.stage}-${index}`} className="ib-step">
                <div className={`ib-step-node ib-lane--${lane(step.role)}`}>{index + 1}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium">{step.stage}</span>
                    {step.decision ? <span className={`ib-decision ib-decision--${step.decision === "held" ? "wait" : step.decision}`}>{step.decision}</span> : null}
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">{step.model} · {step.mode}</div>
                  <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">{step.summary}</p>
                  <div className="ib-latency mt-2">
                    <span style={{ width: `${Math.max(6, (step.ms / max) * 100)}%`, background: "var(--border-strong)" }} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <aside className="h-fit rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="ib-eyebrow">Models</div>
          <dl className="mt-3 flex flex-col gap-3 text-[12px]">
            <Row label="Guard" value={data.meta.models.classifier} />
            <Row label="Assistant" value={data.meta.models.assistant} />
            <Row label="Escalation" value={data.meta.models.escalation || "Super, only if needed"} />
            <Row label="Memory" value="local/sqlite" />
            <Row label="Tools" value="local/approval-gate" />
            <Row label="Not called" value={data.meta.models.excluded || "Ultra"} />
          </dl>
          <p className="mt-4 text-[12px] leading-5 text-[var(--text-tertiary)]">{data.meta.safetyModelNote}</p>
        </aside>
      </div>
    </div>
  );
}

function lane(role: string): string {
  if (role === "classifier" || role === "detector" || role === "guard" || role === "safety") return "guard";
  if (role === "assistant") return "reason";
  if (role === "tool") return "tool";
  return "memory";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--text-tertiary)]">{label}</dt>
      <dd className="ib-mono mt-0.5 break-all text-[var(--text)]">{value}</dd>
    </div>
  );
}
