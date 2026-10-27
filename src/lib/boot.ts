import { z } from "zod";

const liveEnv = z
  .object({
    NEBIUS_API_KEY: z.string().min(1),
    BODYGUARD_ALLOW_LIVE: z.literal("1"),
    DEMO_MODE: z.enum(["false", "0", "no"]),
    LLM_ENABLED: z.enum(["true", "1", "yes"]),
  })
  .strict();

/**
 * Called from instrumentation at server start, never at import.
 * Demo stays the default. A process that asked for live calls and is missing
 * the key, the opt-in, or a safe model fails before it serves traffic.
 */
export function assertBootEnv(): void {
  const demo = (process.env.DEMO_MODE ?? "").trim().toLowerCase();
  const llm = (process.env.LLM_ENABLED ?? "").trim().toLowerCase();
  const explicitLive = demo === "false" || demo === "0" || demo === "no";
  const llmOn = llm === "true" || llm === "1" || llm === "yes";
  if (!explicitLive || !llmOn) return;
  const parsed = liveEnv.safeParse({
    NEBIUS_API_KEY: process.env.NEBIUS_API_KEY?.trim() ?? "",
    BODYGUARD_ALLOW_LIVE: process.env.BODYGUARD_ALLOW_LIVE?.trim(),
    DEMO_MODE: demo,
    LLM_ENABLED: llm,
  });
  if (!parsed.success) {
    throw new Error(
      "Live mode is misconfigured. Set NEBIUS_API_KEY and BODYGUARD_ALLOW_LIVE=1, with DEMO_MODE off and LLM_ENABLED on.",
    );
  }
  const guard = process.env.NEBIUS_GUARD_MODEL?.trim() ?? "";
  if (/ultra|super/i.test(guard)) throw new Error("The guard model cannot be Super or Ultra.");
  const assistant = process.env.NEBIUS_ASSISTANT_MODEL?.trim() ?? "";
  if (/ultra/i.test(assistant)) throw new Error("Ultra is excluded from the live path.");
}
