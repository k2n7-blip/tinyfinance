import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { date } from "@/lib/modules";
import { AppError, databaseError } from "@/lib/errors";
import { route, jsonBody } from "@/lib/http";
export const PATCH = route(async (req: NextRequest) => {
  const a = await getContext("admin");
  const body = z
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
      ai_enabled: z.boolean(),
      record_version: z.number().int().positive(),
    })
    .strict()
    .parse(await jsonBody(req));
  const { record_version, ...patch } = body;
  const { data, error } = await a.client
    .from("finance_settings")
    .update(patch)
    .eq("organization_id", a.org)
    .eq("record_version", record_version)
    .select("*")
    .maybeSingle();
  if (error) databaseError(error);
  if (!data)
    throw new AppError(
      409,
      "Einstellungen wurden inzwischen geändert. Bitte neu laden.",
    );
  return NextResponse.json({ row: data });
});
