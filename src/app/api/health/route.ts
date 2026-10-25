import { connection } from "next/server";
import { NextResponse } from "next/server";

import { budgetStatus } from "@/lib/budget";
import { appMeta } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { ensureReady } from "@/lib/store";

export async function GET() {
  await connection();
  try {
    await ensureReady();
    const budget = budgetStatus();
    const meta = appMeta();
    return NextResponse.json({
      ok: true,
      demoMode: meta.demoMode,
      llmEnabled: budget.llmEnabled,
      spentUsd: budget.spentUsd,
      budgetUsd: budget.budgetUsd,
      paused: budget.paused,
      banner: budget.banner,
    });
  } catch (error) {
    return jsonError(error);
  }
}
