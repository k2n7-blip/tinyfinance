import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { modules } from "@/lib/modules";
import { AppError, databaseError } from "@/lib/errors";
import { jsonBody, route } from "@/lib/http";
type Params = { params: Promise<{ module: string }> };
export const GET = route(async (req: NextRequest, { params }: Params) => {
  const { module: key } = await params;
  const mod = modules[key];
  if (!mod) throw new AppError(404, "Modul nicht gefunden.");
  const a = await getContext(mod.scope === "admin" ? "read" : mod.scope);
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .parse(req.nextUrl.searchParams.get("page") || 0);
  const search = (req.nextUrl.searchParams.get("search") || "").slice(0, 120);
  let query = a.client
    .from(mod.table)
    .select("*", { count: "exact" })
    .eq("organization_id", a.org)
    .order("id")
    .range(page * 50, page * 50 + 49);
  const field = mod.fields.find((f) => !f.kind || f.kind === "text");
  if (search && field)
    query = query.ilike(
      field.key,
      "%" + search.replace(/[\\%_]/g, "\\$&") + "%",
    );
  const { data, error, count } = await query;
  if (error) databaseError(error);
  return NextResponse.json({ rows: data, total: count, page });
});
export const POST = route(async (req: NextRequest, { params }: Params) => {
  const { module: key } = await params;
  const mod = modules[key];
  if (!mod) throw new AppError(404, "Modul nicht gefunden.");
  const a = await getContext(mod.scope === "read" ? "write" : mod.scope);
  const body = mod.schema.parse(await jsonBody(req));
  const { data, error } = await a.client
    .from(mod.table)
    .insert({ ...body, organization_id: a.org })
    .select("*")
    .single();
  if (error) databaseError(error);
  return NextResponse.json({ row: data }, { status: 201 });
});
export const PATCH = route(async (req: NextRequest, { params }: Params) => {
  const { module: key } = await params;
  const mod = modules[key];
  if (!mod) throw new AppError(404, "Modul nicht gefunden.");
  const a = await getContext(mod.scope === "read" ? "write" : mod.scope);
  const raw = await jsonBody(req);
  const identity = z
    .object({
      id: z.string().uuid(),
      record_version: z.number().int().positive(),
    })
    .parse(raw);
  const { id, record_version, ...fields } = raw;
  const body = mod.schema.parse(fields);
  const { data, error } = await a.client
    .from(mod.table)
    .update(body)
    .eq("organization_id", a.org)
    .eq("id", identity.id)
    .eq("record_version", identity.record_version)
    .select("*")
    .maybeSingle();
  if (error) databaseError(error);
  if (!data)
    throw new AppError(
      409,
      "Der Eintrag wurde inzwischen geändert. Bitte neu laden.",
    );
  return NextResponse.json({ row: data });
});

export const DELETE = route(async (req: NextRequest, { params }: Params) => {
  const { module: key } = await params;
  if (!["properties", "property-units"].includes(key))
    throw new AppError(405, "Löschen ist für diesen Bereich nicht verfügbar.");
  const a = await getContext("private");
  const identity = z
    .object({
      id: z.string().uuid(),
      record_version: z.number().int().positive(),
    })
    .strict()
    .parse(await jsonBody(req));
  const { data, error } = await a.client
    .from(modules[key].table)
    .delete()
    .eq("id", identity.id)
    .eq("organization_id", a.org)
    .eq("record_version", identity.record_version)
    .select("id")
    .maybeSingle();
  if (error?.code === "23503")
    throw new AppError(
      409,
      "Objekt oder Einheit ist noch verknüpft. Bitte deaktivieren, damit die Historie erhalten bleibt.",
    );
  if (error) databaseError(error);
  if (!data)
    throw new AppError(
      409,
      "Eintrag wurde geändert oder konnte nicht gelöscht werden. Falls neu eingerichtet: Migration 012 prüfen.",
    );
  return NextResponse.json({ deleted: true });
});
