import { connection } from "next/server";

import { liveOptIn, PIPELINE_VERSION } from "@/lib/config";
import { runEval } from "@/lib/eval/harness";
import { fail, reply } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { HttpError } from "@/lib/store";

let cachedEval: { version: string; body: unknown } | null = null;

export async function GET(request: Request) {
  const started = Date.now();
  const route = "GET /api/eval";
  await connection();
  try {
    assertIpLimit(clientIp(request));
    if (cachedEval?.version === PIPELINE_VERSION) return reply(request, route, started, cachedEval.body);
    const body = await runEval({ live: false });
    cachedEval = { version: PIPELINE_VERSION, body };
    return reply(request, route, started, body);
  } catch (error) {
    return fail(request, route, started, error);
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  const route = "POST /api/eval";
  await connection();
  try {
    assertIpLimit(clientIp(request));
    if (!liveOptIn()) {
      throw new HttpError(
        "Live eval is off. Set LLM_ENABLED, DEMO_MODE=false, BODYGUARD_ALLOW_LIVE=1, and NEBIUS_API_KEY. This endpoint does not call Token Factory otherwise.",
        409,
        "BUDGET_PAUSED",
      );
    }
    return reply(request, route, started, await runEval({ live: true }));
  } catch (error) {
    return fail(request, route, started, error);
  }
}
