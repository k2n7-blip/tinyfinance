import { NextRequest, NextResponse } from "next/server";
import { getContext } from "@/lib/access";
import { settingsPatchSchema } from "@/lib/settings";
import { AppError, databaseError } from "@/lib/errors";
import { route, jsonBody } from "@/lib/http";
export const PATCH = route(async (req: NextRequest) => {
  const a = await getContext("admin");
  const body = settingsPatchSchema.parse(await jsonBody(req));
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
