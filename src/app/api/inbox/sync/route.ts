import { randomUUID } from "node:crypto";

import { connection } from "next/server";

import { imapFeatureEnabled, liveOptIn } from "@/lib/config";
import { adminOk, fail, reply } from "@/lib/http";
import { pullImap } from "@/lib/imap";
import { assertIpLimit, clientIp, LimitError } from "@/lib/limits";
import { assessEmail } from "@/lib/pipeline";
import { HttpError, saveAssessment } from "@/lib/store";

type Job = { status: "running" | "done" | "error"; count?: number; error?: string };
const jobs = new Map<string, Job>();

export async function POST(request: Request) {
  const started = Date.now();
  const route = "POST /api/inbox/sync";
  await connection();
  try {
    assertIpLimit(clientIp(request));
    if (!imapFeatureEnabled() || !adminOk(request)) {
      throw new HttpError("A real mailbox is not connected on this demo.", 409, "BAD_INPUT");
    }
    const jobId = randomUUID();
    jobs.set(jobId, { status: "running" });
    void runJob(jobId);
    return reply(request, route, started, { jobId, status: "accepted" }, 202);
  } catch (error) {
    if (error instanceof HttpError || error instanceof LimitError) return fail(request, route, started, error);
    return fail(request, route, started, new HttpError("The mailbox could not be read.", 502, "LLM_UNAVAILABLE"));
  }
}

export async function GET(request: Request) {
  const started = Date.now();
  const route = "GET /api/inbox/sync";
  await connection();
  try {
    if (!imapFeatureEnabled() || !adminOk(request)) {
      throw new HttpError("A real mailbox is not connected on this demo.", 409, "BAD_INPUT");
    }
    const jobId = new URL(request.url).searchParams.get("jobId") ?? "";
    const job = jobs.get(jobId);
    if (!job) throw new HttpError("That sync job is not on this machine.", 404, "NOT_FOUND");
    return reply(request, route, started, { jobId, ...job });
  } catch (error) {
    return fail(request, route, started, error);
  }
}

async function runJob(jobId: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  try {
    const messages = await pullImap();
    const live = liveOptIn();
    let count = 0;
    for (const email of messages) {
      if (Date.now() > deadline) break;
      const assessment = await assessEmail(email, { live, measureSandbox: false });
      await saveAssessment(email, assessment, live ? "live" : "demo", "imap");
      count += 1;
    }
    jobs.set(jobId, { status: "done", count });
  } catch {
    jobs.set(jobId, { status: "error", error: "The mailbox could not be read." });
  }
}
