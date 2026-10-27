import { connection } from "next/server";

import { fail, readJson, reply } from "@/lib/http";
import { assertIpLimit, clientIp } from "@/lib/limits";
import { memoryBody } from "@/lib/request-schema";
import { sessionIdFromRequest } from "@/lib/session";
import { addContact, getMemory, HttpError, setPreference } from "@/lib/store";

const MEMORY_BODY_CAP = 16 * 1024;

export async function GET(request: Request) {
  const started = Date.now();
  const route = "GET /api/memory";
  await connection();
  try {
    return reply(request, route, started, await getMemory(sessionIdFromRequest(request)));
  } catch (error) {
    return fail(request, route, started, error);
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  const route = "POST /api/memory";
  await connection();
  try {
    assertIpLimit(clientIp(request));
    const body = await readJson(request, memoryBody, MEMORY_BODY_CAP);
    const sessionId = sessionIdFromRequest(request);
    if (body.contact) {
      await addContact(
        {
          name: body.contact.name,
          email: body.contact.email,
          organization: body.contact.organization ?? "",
        },
        sessionId,
      );
      return reply(request, route, started, await getMemory(sessionId));
    }
    if (!body.key || !body.value) throw new HttpError("A preference needs a name and a value.", 400, "BAD_INPUT");
    await setPreference(body.key, body.value, sessionId);
    return reply(request, route, started, await getMemory(sessionId));
  } catch (error) {
    return fail(request, route, started, error);
  }
}
