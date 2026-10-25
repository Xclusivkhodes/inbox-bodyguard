import { NextResponse } from "next/server";

import { LimitError } from "./limits";
import { HttpError } from "./store";

export function jsonError(error: unknown): NextResponse {
  if (error instanceof LimitError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "The guard could not finish. Nothing was sent." }, { status: 500 });
}

export function adminOk(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-admin-secret") === secret;
}
