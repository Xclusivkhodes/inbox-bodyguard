import { connection } from "next/server";

import { fail, reply } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { sessionIdFromRequest } from "@/lib/session";
import { getInbox, resetDemo } from "@/lib/store";

export async function POST(request: Request) {
  const started = Date.now();
  const route = "POST /api/inbox/reset";
  await connection();
  try {
    assertIpLimit(clientIp(request));
    const sessionId = sessionIdFromRequest(request);
    await resetDemo(sessionId);
    return reply(request, route, started, await getInbox(sessionId));
  } catch (error) {
    return fail(request, route, started, error);
  }
}
