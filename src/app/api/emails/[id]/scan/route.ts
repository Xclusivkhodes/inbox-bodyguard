import { connection } from "next/server";
import { NextResponse } from "next/server";

import { liveOptIn } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { assessEmail } from "@/lib/pipeline";
import { fixtures } from "@/lib/fixtures";
import { getEmail, HttpError, saveAssessment } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    assertIpLimit(clientIp(request));
    if (!liveOptIn()) {
      throw new HttpError(
        "Demo judgments are already on this email. A live rescan needs LLM_ENABLED, DEMO_MODE=false, BODYGUARD_ALLOW_LIVE=1, and NEBIUS_API_KEY.",
        409,
      );
    }
    const { id } = await context.params;
    const fixture = fixtures.find((email) => email.id === id);
    const current = await getEmail(id);
    if (!fixture || !current) throw new HttpError("That email is not in this inbox.", 404);
    const assessment = await assessEmail(fixture, { live: true, measureSandbox: false });
    await saveAssessment(fixture, assessment, "live");
    const email = await getEmail(id);
    return NextResponse.json(email);
  } catch (error) {
    return jsonError(error);
  }
}
