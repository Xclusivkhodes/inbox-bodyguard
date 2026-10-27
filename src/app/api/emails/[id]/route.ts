import { connection } from "next/server";

import { fail, reply } from "@/lib/http";
import { sessionIdFromRequest } from "@/lib/session";
import { getEmail, HttpError } from "@/lib/store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const route = "GET /api/emails/:id";
  await connection();
  try {
    const { id } = await context.params;
    const email = await getEmail(id, sessionIdFromRequest(request));
    if (!email) throw new HttpError("That email is not in this inbox.", 404, "NOT_FOUND");
    return reply(request, route, started, email);
  } catch (error) {
    return fail(request, route, started, error);
  }
}
