export class LimitError extends Error {
  status = 429;
  code = "RATE_LIMITED" as const;
  constructor(message: string) {
    super(message);
    this.name = "LimitError";
  }
}

const ipHits = new Map<string, number[]>();
const paidHits: number[] = [];
let inFlight = 0;
const MAX_IN_FLIGHT = 4;
const MAX_IPS = 2000;

export function resetLimits(): void {
  ipHits.clear();
  paidHits.length = 0;
  inFlight = 0;
}

export function trackedAddresses(): number {
  return ipHits.size;
}

function looksLikeIp(value: string): boolean {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split(".").every((part) => Number(part) <= 255);
  }
  return value.includes(":") && /^[0-9a-f:]+$/i.test(value);
}

/**
 * Right-most hop, and only when a trusted proxy appended it. On Vercel the
 * edge overwrites x-real-ip with the client address, so a caller cannot spoof it.
 */
export function clientIp(request: Request): string {
  if (process.env.VERCEL === "1") {
    const real = request.headers.get("x-real-ip")?.trim();
    if (real && looksLikeIp(real)) return real;
  }
  if (process.env.TRUST_PROXY !== "1") return "direct";
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "direct";
  const hops = forwarded
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const hop = hops[hops.length - 1];
  if (!hop || !looksLikeIp(hop)) return "direct";
  return hop;
}

function evict(now: number): void {
  for (const [ip, stamps] of ipHits) {
    const fresh = stamps.filter((stamp) => now - stamp < 86_400_000);
    if (fresh.length === 0) ipHits.delete(ip);
    else if (fresh.length !== stamps.length) ipHits.set(ip, fresh);
  }
  while (ipHits.size > MAX_IPS) {
    const oldest = ipHits.keys().next().value;
    if (!oldest) break;
    ipHits.delete(oldest);
  }
}

export function assertIpLimit(ip: string): void {
  if (process.env.BODYGUARD_RELAX_LIMITS === "1") return;
  const now = Date.now();
  if (ipHits.size > 256) evict(now);
  const stamps = (ipHits.get(ip) ?? []).filter((stamp) => now - stamp < 86_400_000);
  const minute = stamps.filter((stamp) => now - stamp < 60_000);
  if (minute.length >= 5 || stamps.length >= 30) {
    throw new LimitError("Too many requests from this network. Try a sample email.");
  }
  stamps.push(now);
  ipHits.delete(ip);
  ipHits.set(ip, stamps);
  if (ipHits.size > MAX_IPS) evict(now);
}

function takePaidSlot(): void {
  const now = Date.now();
  while (paidHits.length && now - paidHits[0] > 60_000) paidHits.shift();
  if (paidHits.length >= 20) throw new LimitError("Inbox Bodyguard is busy. Try a sample email.");
  paidHits.push(now);
}

/** Wait up to 2s for a live slot, then fail. Callers are not queued without a bound. */
export async function withLiveSlot<T>(fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  while (inFlight >= MAX_IN_FLIGHT) {
    if (Date.now() - started >= 2_000) throw new LimitError("Inbox Bodyguard is busy. Try a sample email.");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  inFlight += 1;
  try {
    takePaidSlot();
    return await fn();
  } finally {
    inFlight -= 1;
  }
}
