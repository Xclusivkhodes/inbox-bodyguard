import { connection } from "next/server";

import { liveOptIn } from "@/lib/config";
import { fail, reply } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { assessEmail } from "@/lib/pipeline";
import { fixtures } from "@/lib/fixtures";
import { contactEmails, getEmail, HttpError, saveAssessment } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const route = "POST /api/emails/:id/scan";
  await connection();
  try {
    assertIpLimit(clientIp(request));
    if (!liveOptIn()) {
      throw new HttpError(
        "Demo judgments are already on this email. A live rescan needs LLM_ENABLED, DEMO_MODE=false, BODYGUARD_ALLOW_LIVE=1, and NEBIUS_API_KEY.",
        409,
        "BUDGET_PAUSED",
      );
    }
    const { id } = await context.params;
    const fixture = fixtures.find((email) => email.id === id);
    const current = await getEmail(id);
    if (!fixture || !current) throw new HttpError("That email is not in this inbox.", 404, "NOT_FOUND");
    const assessment = await assessEmail(fixture, {
      live: true,
      measureSandbox: false,
      extraRecipients: await contactEmails(),
    });
    await saveAssessment(fixture, assessment, "live");
    const email = await getEmail(id);
    return reply(request, route, started, email);
  } catch (error) {
    return fail(request, route, started, error);
  }
}
