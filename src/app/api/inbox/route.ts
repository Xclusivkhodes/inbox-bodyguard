import { connection } from "next/server";

import { fail, reply } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { sessionIdFromRequest } from "@/lib/session";
import { getInbox } from "@/lib/store";

export async function GET(request: Request) {
  const started = Date.now();
  const route = "GET /api/inbox";
  await connection();
  try {
    return reply(request, route, started, await getInbox(sessionIdFromRequest(request)));
  } catch (error) {
    return fail(request, route, started, error);
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  const route = "POST /api/inbox";
  await connection();
  try {
    assertIpLimit(clientIp(request));
    return reply(request, route, started, await getInbox(sessionIdFromRequest(request)));
  } catch (error) {
    return fail(request, route, started, error);
  }
}
