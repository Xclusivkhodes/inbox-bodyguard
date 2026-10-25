import { connection } from "next/server";
import { NextResponse } from "next/server";

import { liveOptIn } from "@/lib/config";
import { runEval } from "@/lib/eval/harness";
import { jsonError } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { HttpError } from "@/lib/store";

export async function GET() {
  await connection();
  try {
    return NextResponse.json(await runEval({ live: false }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    assertIpLimit(clientIp(request));
    if (!liveOptIn()) {
      throw new HttpError(
        "Live eval is off. Set LLM_ENABLED, DEMO_MODE=false, BODYGUARD_ALLOW_LIVE=1, and NEBIUS_API_KEY. This endpoint does not call Token Factory otherwise.",
        409,
      );
    }
    return NextResponse.json(await runEval({ live: true }));
  } catch (error) {
    return jsonError(error);
  }
}
