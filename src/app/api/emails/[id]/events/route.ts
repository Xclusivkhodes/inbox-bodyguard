import { connection } from "next/server";

import { fail } from "@/lib/http";
import { logRequest, requestIdFrom } from "@/lib/observe";
import { sessionIdFromRequest } from "@/lib/session";
import { getEmail, HttpError } from "@/lib/store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const route = "GET /api/emails/:id/events";
  await connection();
  try {
    const { id } = await context.params;
    const email = await getEmail(id, sessionIdFromRequest(request));
    if (!email) throw new HttpError("That email is not in this inbox.", 404, "NOT_FOUND");
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        send("replay", { replay: true, note: "This is a replay of the stored trace." });
        for (const step of email.assessment.trace) {
          await new Promise((resolve) => setTimeout(resolve, 220));
          send("stage", step);
        }
        send("done", { guardDown: email.assessment.guardDown, verdict: email.assessment.guard.verdict, replay: true });
        controller.close();
      },
    });
    logRequest({ request, route, status: 200, ms: Date.now() - started });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Stream-Mode": "replay",
        "x-request-id": requestIdFrom(request),
      },
    });
  } catch (error) {
    return fail(request, route, started, error);
  }
}
