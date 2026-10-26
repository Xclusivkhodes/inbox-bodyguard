import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "ib-session";

function secret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  const holder = globalThis as unknown as { __ibSessionSecret?: string };
  if (!holder.__ibSessionSecret) holder.__ibSessionSecret = randomBytes(32).toString("hex");
  return holder.__ibSessionSecret;
}

export function cookieName(): string {
  return COOKIE;
}

export function signSession(id: string): string {
  const sig = createHmac("sha256", secret()).update(id).digest("base64url");
  return `${id}.${sig}`;
}

export function verifySession(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  const expected = createHmac("sha256", secret()).update(id).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return id;
}

export function mintSession(): { id: string; token: string } {
  const id = randomBytes(16).toString("hex");
  return { id, token: signSession(id) };
}

/** The proxy overwrites this header with a signed token. A client-supplied value only counts if it verifies. */
export function sessionIdFromRequest(request: Request): string {
  const header = verifySession(request.headers.get("x-ib-session"));
  if (header) return header;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)ib-session=([^;]+)/);
  return verifySession(match ? decodeURIComponent(match[1]) : null) ?? "";
}
