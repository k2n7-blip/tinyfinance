import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { AppError, databaseError } from "@/lib/errors";
import { route } from "@/lib/http";
export const GET = route(async (req: NextRequest) => {
  const a = await getContext();
  const id = z.string().uuid().parse(req.nextUrl.searchParams.get("document"));
  const { data: doc } = await a.client
    .from("documents")
    .select("id")
    .eq("id", id)
    .eq("organization_id", a.org)
    .maybeSingle();
  if (!doc) throw new AppError(404, "Beleg nicht verfügbar.");
  const { data, error } = await a.client
    .from("audit_events")
    .select("*")
    .eq("organization_id", a.org)
    .eq("entity_type", "documents")
    .eq("entity_id", id)
    .order("at", { ascending: false })
    .limit(200);
  if (error) databaseError(error);
  return NextResponse.json({ rows: data });
});
