import { reply } from "@/lib/http";

/** Liveness. No database or spend read. */
export function GET(request: Request) {
  return reply(request, "GET /api/healthz", Date.now(), { ok: true });
}
