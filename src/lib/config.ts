import { aiSpendCapUsd, DEFAULT_AI_SPEND_CAP_USD } from "./ai-spend-cap";

/**
 * Model IDs checked against the Nebius Token Factory catalog on 25 Oct 2026:
 * https://tokenfactory.nebius.com/model-catalog.md
 * https://docs.tokenfactory.nebius.com/api-reference/introduction
 *
 * No dedicated NVIDIA safety-guard or content-safety model ID was in that
 * public catalog. NEBIUS_SAFETY_MODEL is the slot for one when it is listed.
 */

export const PIPELINE_VERSION = "2026-10-26.1";

export const DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1";

/** Guard classifier and triage. Catalog id checked 25 Oct 2026. */
export const NANO_MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
/** Escalation only, and only while spend is under the soft limit. */
export const SUPER_MODEL = "nvidia/nemotron-3-super-120b-a12b";
/** Listed so we can reject it. Never used on the live path. */
export const ULTRA_MODEL = "nvidia/Nemotron-3-Ultra-550b-a55b";
export const LIGHTNING_MODEL = "nvidia/Nemotron-3_5-Lightning";

export const DEFAULT_CLASSIFIER_MODEL = NANO_MODEL;
export const DEFAULT_ASSISTANT_MODEL = NANO_MODEL;
export const DEFAULT_VISION_MODEL = "nvidia/Nemotron-3.5-Super-VL";
/** Global completion ceiling. Role caps are tighter: guard 300, triage 500, Super 1000. */
export const DEFAULT_MAX_TOKENS = 1024;
export const HARD_TOKEN_CEILING = 1024;
export const DEFAULT_BUDGET_USD = DEFAULT_AI_SPEND_CAP_USD;
export const EMAIL_BODY_CAP = 4000;
export const PASTE_CAP = 2000;

export function baseURL(): string {
  const raw = process.env.NEBIUS_BASE_URL?.trim() || DEFAULT_BASE_URL;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export function classifierModel(): string {
  return process.env.NEBIUS_GUARD_MODEL?.trim() || DEFAULT_CLASSIFIER_MODEL;
}

export function assistantModel(): string {
  return process.env.NEBIUS_ASSISTANT_MODEL?.trim() || DEFAULT_ASSISTANT_MODEL;
}

export function visionModel(): string {
  return process.env.NEBIUS_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;
}

export function safetyModel(): string | null {
  const value = process.env.NEBIUS_SAFETY_MODEL?.trim();
  return value ? value : null;
}

export function isUltraModel(model: string): boolean {
  return /ultra/i.test(model);
}

export function isSuperModel(model: string): boolean {
  return /super/i.test(model);
}

/** Guard calls never go to Super or Ultra. Lightning remains an env override. */
export function guardModel(): string {
  const requested = classifierModel();
  if (isUltraModel(requested) || isSuperModel(requested)) return NANO_MODEL;
  return requested;
}

/** Default triage model. Super is chosen later, per email, and only as an escalation. */
export function effectiveAssistantModel(): string {
  const requested = assistantModel();
  if (isUltraModel(requested) || isSuperModel(requested)) return NANO_MODEL;
  return requested;
}

export function classifierMaxTokens(): number {
  return Math.min(300, maxTokens());
}

export function assistantMaxTokens(): number {
  return Math.min(500, maxTokens());
}

export function superMaxTokens(): number {
  return Math.min(1000, maxTokens());
}

/** Manual kill switch. Unset or anything other than true/1/yes stays off. */
export function llmEnabled(): boolean {
  const flag = process.env.LLM_ENABLED?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/** The hard AI spend cap (AI_SPEND_CAP_USD). See ai-spend-cap.ts. */
export function budgetUsd(): number {
  return aiSpendCapUsd();
}

/** Completion-token cap for a single Token Factory request. */
export function maxTokens(): number {
  const raw = Number(process.env.NEBIUS_MAX_TOKENS);
  const chosen = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_TOKENS;
  return Math.min(Math.max(chosen, 64), HARD_TOKEN_CEILING);
}

/**
 * Last line of defence for the credit budget. Live HTTP calls require all of:
 * a key, DEMO_MODE off, and BODYGUARD_ALLOW_LIVE=1.
 */
export function liveOptIn(): boolean {
  return (
    llmEnabled() &&
    process.env.BODYGUARD_ALLOW_LIVE?.trim() === "1" &&
    !demoMode() &&
    Boolean(process.env.NEBIUS_API_KEY?.trim())
  );
}

export function assertLiveOptIn(): void {
  if (!llmEnabled()) {
    throw new Error("LLM_ENABLED is off. Live calls stay disabled.");
  }
  if (process.env.BODYGUARD_ALLOW_LIVE?.trim() !== "1") {
    throw new Error(
      "Live Token Factory calls are disabled. Set BODYGUARD_ALLOW_LIVE=1 to opt in. Demo mode does not call the API.",
    );
  }
  if (!process.env.NEBIUS_API_KEY?.trim()) {
    throw new Error("NEBIUS_API_KEY is not set.");
  }
  if (demoMode()) {
    throw new Error("DEMO_MODE is on. Set DEMO_MODE=false before a live call.");
  }
}

export function visionEnabled(): boolean {
  const flag = process.env.GUARD_VISION?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/** Explicit DEMO_MODE wins. Otherwise a missing key is demo mode. */
export function demoMode(): boolean {
  const flag = process.env.DEMO_MODE?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  return !process.env.NEBIUS_API_KEY?.trim();
}

export function liveReady(): boolean {
  return !demoMode() && Boolean(process.env.NEBIUS_API_KEY?.trim());
}

export function inboxSource(): "fixtures" | "imap" {
  return process.env.INBOX_SOURCE?.trim().toLowerCase() === "imap" ? "imap" : "fixtures";
}

/** Real mail stays off the public demo. All four have to be set. */
export function imapFeatureEnabled(): boolean {
  return (
    process.env.PUBLIC_DEMO === "false" &&
    Boolean(process.env.ADMIN_SECRET?.trim()) &&
    inboxSource() === "imap" &&
    Boolean(process.env.IMAP_HOST?.trim() && process.env.IMAP_USER?.trim() && process.env.IMAP_PASSWORD)
  );
}

export function appMeta() {
  const safety = safetyModel();
  return {
    demoMode: demoMode(),
    liveReady: liveReady(),
    liveOptIn: liveOptIn(),
    inboxSource: inboxSource(),
    pipelineVersion: PIPELINE_VERSION,
    maxTokens: maxTokens(),
    models: {
      baseURL: baseURL(),
      classifier: guardModel(),
      assistant: effectiveAssistantModel(),
      escalation: SUPER_MODEL,
      vision: visionModel(),
      safety,
      excluded: ULTRA_MODEL,
    },
    safetyModelNote: safety
      ? `Extra safety model ${safety} is fused into the guard when a live scan runs.`
      : "No dedicated NVIDIA safety-guard model is in the Token Factory catalog. The guard and triage both default to Nemotron Nano. Super is an escalation only. Ultra is not on the live path. Set NEBIUS_SAFETY_MODEL to add a safety model on a live scan.",
  };
}
