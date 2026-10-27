import { z } from "zod";

const actionType = z.enum([
  "draft_reply",
  "label",
  "reminder",
  "forward",
  "send",
  "memory_write",
  "exfiltrate",
  "delete",
]);

export const classifierOutput = z
  .object({
    verdict: z.enum(["allow", "clear", "sanitize", "quarantine"]),
    categories: z.array(z.string().max(80)).max(12).optional(),
    confidence: z.number().min(0).max(1).optional(),
    explanation: z.string().max(2000).optional(),
    spans: z.array(z.string().max(500)).max(20).optional(),
  })
  .strict();

export const assistantOutput = z
  .object({
    summary: z.string().max(2000),
    triage: z.enum(["now", "today", "later", "fyi"]),
    draft: z.string().max(4000),
    actions: z
      .array(
        z
          .object({
            type: actionType,
            title: z.string().max(200).optional(),
            detail: z.string().max(2000).optional(),
            to: z.string().max(200).optional(),
          })
          .strict(),
      )
      .max(6)
      .optional(),
  })
  .strict();

export const sandboxOutput = z
  .object({
    complied: z.boolean().optional(),
    actions: z
      .array(
        z
          .object({
            type: z.string().max(40).optional(),
            to: z.string().max(200).optional(),
            detail: z.string().max(2000).optional(),
          })
          .strict(),
      )
      .max(8)
      .optional(),
  })
  .strict();
