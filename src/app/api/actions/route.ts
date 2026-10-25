import { connection } from "next/server";
import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { PASTE_CAP } from "@/lib/config";
import { decide, HttpError } from "@/lib/store";

export async function POST(request: Request) {
  await connection();
  try {
    assertIpLimit(clientIp(request));
    const body = (await request.json()) as { emailId?: string; actionId?: string; decision?: string };
    if (!body.emailId || !body.actionId || (body.decision !== "approved" && body.decision !== "denied")) {
      throw new HttpError("Say which email, which action, and whether it is approved or denied.", 400);
    }
    if (body.emailId.length > 120 || body.actionId.length > PASTE_CAP) {
      throw new HttpError("That request is too large.", 400);
    }
    const email = await decide(body.emailId, body.actionId, body.decision);
    return NextResponse.json({ email, note: "Recorded on this machine. No mail was transmitted." });
  } catch (error) {
    return jsonError(error);
  }
}
