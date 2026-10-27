export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { assertBootEnv } = await import("./lib/boot");
  assertBootEnv();
}
