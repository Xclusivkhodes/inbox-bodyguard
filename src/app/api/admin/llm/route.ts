import { connection } from "next/server";
import { NextResponse } from "next/server";

import { budgetStatus, setAdminPause } from "@/lib/budget";
import { adminOk, jsonError } from "@/lib/http";
import { HttpError } from "@/lib/store";

export async function POST(request: Request) {
  await connection();
  try {
    if (!adminOk(request)) throw new HttpError("Not allowed.", 403);
    const body = (await request.json()) as { enabled?: boolean };
    setAdminPause(body.enabled === false);
    return NextResponse.json(budgetStatus());
  } catch (error) {
    return jsonError(error);
  }
}
