import { connection } from "next/server";

import { budgetStatus, setAdminPause } from "@/lib/budget";
import { adminOk, fail, readJson, reply } from "@/lib/http";
import { pauseBody } from "@/lib/request-schema";
import { HttpError } from "@/lib/store";

export async function POST(request: Request) {
  const started = Date.now();
  const route = "POST /api/admin/llm";
  await connection();
  try {
    if (!adminOk(request)) throw new HttpError("Not allowed.", 403, "BAD_INPUT");
    const body = await readJson(request, pauseBody);
    setAdminPause(body.enabled === false);
    return reply(request, route, started, budgetStatus());
  } catch (error) {
    return fail(request, route, started, error);
  }
}
