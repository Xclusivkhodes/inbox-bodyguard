import { connection } from "next/server";

import { fail, readJson, reply } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { actionBody } from "@/lib/request-schema";
import { sessionIdFromRequest } from "@/lib/session";
import { decide } from "@/lib/store";

export async function POST(request: Request) {
  const started = Date.now();
  const route = "POST /api/actions";
  await connection();
  try {
    assertIpLimit(clientIp(request));
    const body = await readJson(request, actionBody);
    const email = await decide(body.emailId, body.actionId, body.decision, sessionIdFromRequest(request));
    return reply(request, route, started, { email, note: "Recorded on this machine. No mail was transmitted." });
  } catch (error) {
    return fail(request, route, started, error);
  }
}
