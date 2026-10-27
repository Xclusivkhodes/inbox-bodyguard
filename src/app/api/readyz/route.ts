import { NextResponse } from "next/server";

import { budgetStatus } from "@/lib/budget";
import { demoMode } from "@/lib/config";
import { getDb } from "@/lib/db";
import { reply } from "@/lib/http";
import { breakerOpen } from "@/lib/nebius";
import { logRequest, requestIdFrom } from "@/lib/observe";

export function GET(request: Request) {
  const started = Date.now();
  const route = "GET /api/readyz";
  try {
    getDb()
      .prepare(
        `INSERT INTO meta (key, value) VALUES ('ready_probe', '1')
         ON CONFLICT(key) DO UPDATE SET value = '1'`,
      )
      .run();
    const budget = budgetStatus();
    const llm = breakerOpen() ? "breaker_open" : budget.paused ? "paused" : "ok";
    return reply(request, route, started, { ok: true, mode: demoMode() ? "demo" : "live", llm });
  } catch {
    const response = NextResponse.json(
      { ok: false, mode: demoMode() ? "demo" : "live", llm: "paused" },
      { status: 503 },
    );
    response.headers.set("x-request-id", requestIdFrom(request));
    logRequest({ request, route, status: 503, ms: Date.now() - started });
    return response;
  }
}
