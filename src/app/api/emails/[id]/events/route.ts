import { connection } from "next/server";

import { jsonError } from "@/lib/http";
import { getEmail, HttpError } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { id } = await context.params;
    const email = await getEmail(id);
    if (!email) throw new HttpError("That email is not in this inbox.", 404);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        for (const step of email.assessment.trace) {
          await new Promise((resolve) => setTimeout(resolve, 220));
          send("stage", step);
        }
        send("done", { guardDown: email.assessment.guardDown, verdict: email.assessment.guard.verdict });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
