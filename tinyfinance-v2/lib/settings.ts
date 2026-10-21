import { z } from "zod";
import { date } from "./modules";

export const aiSettingsSchema = z
  .object({
    ai_enabled: z.boolean(),
    record_version: z.number().int().positive(),
  })
  .strict();

export const datevSettingsSchema = z
  .object({
    framework: z.enum(["SKR03", "SKR04"]),
    advisor_number: z
      .string()
      .regex(/^[0-9]{4,7}$/)
      .refine((v) => Number(v) >= 1001),
    client_number: z
      .string()
      .regex(/^[0-9]{1,5}$/)
      .refine((v) => Number(v) > 0),
    fiscal_year_start: date,
    account_length: z.coerce.number().int().min(4).max(8),
    datev_test_import_confirmed: z.boolean(),
    // Accept the previous complete settings payload during deployment rollout.
    ai_enabled: z.boolean().optional(),
    record_version: z.number().int().positive(),
  })
  .strict();

export const settingsPatchSchema = z.union([
  aiSettingsSchema,
  datevSettingsSchema,
]);
