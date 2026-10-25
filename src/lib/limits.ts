export class LimitError extends Error {
  status = 429;
  constructor(message: string) {
    super(message);
    this.name = "LimitError";
  }
}

const ipHits = new Map<string, number[]>();
const paidHits: number[] = [];
let inFlight = 0;
const MAX_IN_FLIGHT = 4;

export function resetLimits(): void {
  ipHits.clear();
  paidHits.length = 0;
  inFlight = 0;
}

export function clientIp(request: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = request.headers.get("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    if (first) return first;
  }
  return "direct";
}

export function assertIpLimit(ip: string): void {
  const now = Date.now();
  const stamps = (ipHits.get(ip) ?? []).filter((stamp) => now - stamp < 86_400_000);
  const minute = stamps.filter((stamp) => now - stamp < 60_000);
  if (minute.length >= 5 || stamps.length >= 30) {
    throw new LimitError("Too many requests from this network. Try a sample email.");
  }
  stamps.push(now);
  ipHits.set(ip, stamps);
}

function takePaidSlot(): void {
  const now = Date.now();
  while (paidHits.length && now - paidHits[0] > 60_000) paidHits.shift();
  if (paidHits.length >= 20) throw new LimitError("Inbox Bodyguard is busy. Try a sample email.");
  paidHits.push(now);
}

export async function withLiveSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) throw new LimitError("Inbox Bodyguard is busy. Try a sample email.");
  inFlight += 1;
  try {
    takePaidSlot();
    return await fn();
  } finally {
    inFlight -= 1;
  }
}
