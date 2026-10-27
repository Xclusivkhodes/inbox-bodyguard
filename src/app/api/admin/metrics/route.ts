import { connection } from "next/server";

import { budgetStatus } from "@/lib/budget";
import { adminOk, fail, reply } from "@/lib/http";
import { metricsSnapshot } from "@/lib/observe";
import { HttpError } from "@/lib/store";

export async function GET(request: Request) {
  const started = Date.now();
  const route = "GET /api/admin/metrics";
  await connection();
  try {
    if (!adminOk(request)) throw new HttpError("Not allowed.", 403, "BAD_INPUT");
    const budget = budgetStatus();
    return reply(request, route, started, {
      budget: {
        spentUsd: budget.spentUsd,
        budgetUsd: budget.budgetUsd,
        paused: budget.paused,
        soft: budget.soft,
        hard: budget.hard,
        ledgerOk: budget.ledgerOk,
      },
      ...metricsSnapshot(),
    });
  } catch (error) {
    return fail(request, route, started, error);
  }
}
