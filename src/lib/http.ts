import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { LimitError } from "./limits";
import { logJson, logRequest, requestIdFrom } from "./observe";
import { HttpError } from "./store";

export const JSON_BODY_CAP = 64 * 1024;

export type ErrorCode = "RATE_LIMITED" | "BAD_INPUT" | "LLM_UNAVAILABLE" | "BUDGET_PAUSED" | "NOT_FOUND" | "INTERNAL";

function codeFor(error: HttpError): ErrorCode {
  if (error.code === "RATE_LIMITED" || error.code === "BAD_INPUT" || error.code === "LLM_UNAVAILABLE" || error.code === "BUDGET_PAUSED" || error.code === "NOT_FOUND" || error.code === "INTERNAL") {
    return error.code;
  }
  if (error.status === 404) return "NOT_FOUND";
  if (error.status === 400 || error.status === 413 || error.status === 403) return "BAD_INPUT";
  if (error.status === 409) return "BUDGET_PAUSED";
  if (error.status === 503 || error.status === 502) return "LLM_UNAVAILABLE";
  return "INTERNAL";
}

export function jsonError(error: unknown, request?: Request): NextResponse {
  const requestId = request ? requestIdFrom(request) : undefined;
  let status = 500;
  let code: ErrorCode = "INTERNAL";
  let message = "The guard could not finish. Nothing was sent.";
  if (error instanceof LimitError) {
    status = 429;
    code = "RATE_LIMITED";
    message = error.message;
  } else if (error instanceof HttpError) {
    status = error.status;
    code = codeFor(error);
    message = error.message;
  } else if (error instanceof Error && error.name === "NebiusError") {
    status = 503;
    code = "LLM_UNAVAILABLE";
    message = "The model did not answer. Nothing was sent.";
  }
  const response = NextResponse.json({ error: message, code, requestId }, { status });
  if (requestId) response.headers.set("x-request-id", requestId);
  return response;
}

export function reply(request: Request, route: string, started: number, body: unknown, status = 200): NextResponse {
  const requestId = requestIdFrom(request);
  const response = NextResponse.json(body, { status });
  response.headers.set("x-request-id", requestId);
  logRequest({ request, route, status, ms: Date.now() - started });
  return response;
}

export function fail(request: Request, route: string, started: number, error: unknown): NextResponse {
  const response = jsonError(error, request);
  if (!(error instanceof LimitError) && !(error instanceof HttpError)) {
    logJson({
      level: "error",
      requestId: requestIdFrom(request),
      route,
      outcome: error instanceof Error ? error.name : "error",
      message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
  }
  logRequest({ request, route, status: response.status, ms: Date.now() - started });
  return response;
}

/** 413 before JSON.parse. Unknown fields fail. */
export async function readJson<T>(request: Request, schema: ZodType<T>, cap = JSON_BODY_CAP): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > cap) {
    throw new HttpError("That request is too large.", 413, "BAD_INPUT");
  }
  const raw = await request.text();
  if (raw.length > cap) throw new HttpError("That request is too large.", 413, "BAD_INPUT");
  let parsed: unknown;
  try {
    parsed = raw.length === 0 ? {} : JSON.parse(raw);
  } catch {
    throw new HttpError("That request is not valid JSON.", 400, "BAD_INPUT");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new HttpError("That request is not valid.", 400, "BAD_INPUT");
  return result.data;
}

export function adminOk(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET?.trim() ?? "";
  const provided = request.headers.get("x-admin-secret") ?? "";
  if (!secret || !provided) return false;
  const left = Buffer.from(secret);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
