import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { mintSession, signSession, verifySession } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const inbound = request.headers.get("x-request-id")?.trim() ?? "";
  const requestId = UUID.test(inbound) ? inbound : crypto.randomUUID();
  requestHeaders.set("x-request-id", requestId);

  const existing = verifySession(request.cookies.get("ib-session")?.value);
  const minted = existing ? null : mintSession();
  const sessionId = existing ?? minted!.id;
  requestHeaders.set("x-ib-session", signSession(sessionId));

  const origin = request.headers.get("origin");
  const allow = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const headers = new Headers();
  if (request.nextUrl.pathname.startsWith("/api") && origin && allow.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "Content-Type, x-admin-secret, x-request-id");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (request.method === "OPTIONS" && request.nextUrl.pathname.startsWith("/api")) {
    return new NextResponse(null, { status: 204, headers });
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  headers.forEach((value, key) => response.headers.set(key, value));
  response.headers.set("x-request-id", requestId);
  if (minted) {
    response.cookies.set("ib-session", minted.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.COOKIE_SECURE === "1",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
