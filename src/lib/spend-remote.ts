const KEY = "inbox-bodyguard:spend_usd";

/** Upstash directly, or the same Redis added through Vercel's KV / Upstash integration. */
function redisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim() || undefined;
}

function redisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim() || undefined;
}

export function spendBackend(): "sqlite" | "upstash" | "turso" {
  if (redisUrl() && redisToken()) return "upstash";
  if (process.env.TURSO_DATABASE_URL?.trim() && process.env.TURSO_AUTH_TOKEN?.trim()) return "turso";
  return "sqlite";
}

let remoteSpent: number | null = null;
let remoteBroken = false;

export function remoteSpendState(): { active: boolean; spent: number | null; broken: boolean } {
  return { active: spendBackend() !== "sqlite", spent: remoteSpent, broken: remoteBroken };
}

export function noteRemoteSpend(usd: number): void {
  if (remoteSpent == null) remoteSpent = 0;
  remoteSpent += usd;
}

export function markRemoteBroken(): void {
  remoteBroken = true;
}

async function upstash(command: unknown[]): Promise<unknown> {
  const url = redisUrl()!.replace(/\/$/, "");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error("Spend store is unavailable.");
  const body = (await response.json()) as { result?: unknown };
  return body.result;
}

async function turso(sql: string, args: string[] = []): Promise<unknown> {
  const base = process.env.TURSO_DATABASE_URL!.trim().replace(/^libsql:\/\//, "https://").replace(/\/$/, "");
  const response = await fetch(`${base}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql, args: args.map((value) => ({ type: "text", value })) } },
        { type: "close" },
      ],
    }),
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error("Spend store is unavailable.");
  return response.json();
}

export async function hydrateRemoteSpend(): Promise<void> {
  if (spendBackend() === "sqlite") return;
  try {
    if (spendBackend() === "upstash") {
      const value = await upstash(["GET", KEY]);
      remoteSpent = Number(value ?? 0);
    } else {
      await turso("CREATE TABLE IF NOT EXISTS spend_total (id INTEGER PRIMARY KEY, usd REAL NOT NULL)");
      const body = (await turso("SELECT usd FROM spend_total WHERE id = 1")) as {
        results?: { response?: { result?: { rows?: { value?: string }[][] } } }[];
      };
      const cell = body.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value;
      remoteSpent = Number(cell ?? 0);
    }
    if (!Number.isFinite(remoteSpent)) throw new Error("Spend store is unavailable.");
    remoteBroken = false;
  } catch {
    remoteBroken = true;
    remoteSpent = null;
  }
}

export async function addRemoteSpend(usd: number): Promise<void> {
  if (spendBackend() === "upstash") {
    const value = await upstash(["INCRBYFLOAT", KEY, String(usd)]);
    const next = Number(value);
    if (!Number.isFinite(next)) throw new Error("Spend store is unavailable.");
    remoteSpent = next;
    return;
  }
  if (spendBackend() === "turso") {
    await turso(
      "INSERT INTO spend_total (id, usd) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET usd = usd + excluded.usd",
      [String(usd)],
    );
    return;
  }
}
