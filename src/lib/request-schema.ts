import { z } from "zod";

import { PASTE_CAP } from "./config";

export const actionBody = z
  .object({
    emailId: z.string().min(1).max(120),
    actionId: z.string().min(1).max(PASTE_CAP),
    decision: z.enum(["approved", "denied"]),
  })
  .strict();

export const memoryBody = z
  .object({
    key: z.string().min(1).max(80).optional(),
    value: z.string().min(1).max(PASTE_CAP).optional(),
    contact: z
      .object({
        name: z.string().max(120),
        email: z.string().max(200),
        organization: z.string().max(80).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const pauseBody = z
  .object({
    enabled: z.boolean().optional(),
  })
  .strict();
