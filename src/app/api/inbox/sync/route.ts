import { connection } from "next/server";
import { NextResponse } from "next/server";

import { liveOptIn } from "@/lib/config";
import { jsonError, adminOk } from "@/lib/http";
import { pullImap } from "@/lib/imap";
import { assertIpLimit, clientIp, LimitError } from "@/lib/limits";
import { assessEmail } from "@/lib/pipeline";
import { HttpError, getInbox, saveAssessment } from "@/lib/store";

export async function POST(request: Request) {
  await connection();
  try {
    assertIpLimit(clientIp(request));
    if (!adminOk(request)) {
      throw new HttpError("A real mailbox is not connected on this demo.", 409);
    }
    const messages = await pullImap();
    const live = liveOptIn();
    for (const email of messages) {
      const assessment = await assessEmail(email, { live, measureSandbox: false });
      await saveAssessment(email, assessment, live ? "live" : "demo", "imap");
    }
    return NextResponse.json(await getInbox());
  } catch (error) {
    if (error instanceof HttpError || error instanceof LimitError) return jsonError(error);
    return NextResponse.json({ error: "The mailbox could not be read." }, { status: 502 });
  }
}
