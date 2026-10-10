import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { documentSchema } from "@/lib/modules";
import { AppError, databaseError } from "@/lib/errors";
import { jsonBody, route } from "@/lib/http";
type Params = { params: Promise<{ id: string }> };
export const GET = route(async (_req: NextRequest, { params }: Params) => {
  const a = await getContext();
  const id = z
    .string()
    .uuid()
    .parse((await params).id);
  const { data: doc, error } = await a.client
    .from("documents")
    .select("storage_path,mime_type,original_filename")
    .eq("id", id)
    .eq("organization_id", a.org)
    .eq("upload_status", "ready")
    .single();
  if (error || !doc) throw new AppError(404, "Beleg nicht verfügbar.");
  const { data, error: storageError } = await a.client.storage
    .from("documents")
    .download(doc.storage_path);
  if (storageError || !data)
    throw new AppError(404, "Original nicht verfügbar.");
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition":
        "inline; filename*=UTF-8''" + encodeURIComponent(doc.original_filename),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
});
export const PATCH = route(async (req: NextRequest, { params }: Params) => {
  const a = await getContext("write");
  const id = z
    .string()
    .uuid()
    .parse((await params).id);
  const { version, ...patch } = documentSchema.parse(await jsonBody(req));
  if (patch.cost_center_id) {
    const { data } = await a.client
      .from("cost_centers")
      .select("id")
      .eq("id", patch.cost_center_id)
      .eq("organization_id", a.org)
      .eq("active", true)
      .maybeSingle();
    if (!data)
      throw new AppError(400, "Kostenstelle ungültig oder deaktiviert.");
  }
  const { data, error } = await a.client
    .from("documents")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", a.org)
    .eq("version", version)
    .select("*")
    .maybeSingle();
  if (error) databaseError(error);
  if (!data)
    throw new AppError(
      409,
      "Beleg wurde inzwischen geändert. Bitte neu laden.",
    );
  return NextResponse.json({ row: data });
});

export const DELETE = route(async (req: NextRequest, { params }: Params) => {
  const a = await getContext("write");
  const id = z
    .string()
    .uuid()
    .parse((await params).id);
  const input = z
    .object({
      version: z.number().int().positive(),
      restore: z.boolean().optional(),
    })
    .strict()
    .parse(await jsonBody(req));
  const { data, error } = await a.client.rpc("set_document_trash", {
    org: a.org,
    doc_id: id,
    expected_version: input.version,
    trash: !input.restore,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883")
      throw new AppError(
        503,
        "Papierkorb noch nicht eingerichtet. Migration 011_document_trash.sql zuerst im Supabase-Testprojekt anwenden.",
      );
    if (error.code === "23503")
      throw new AppError(
        409,
        "Dieser Beleg ist mit Buchungen, Zahlungen oder Objektbuchungen verknüpft und kann nicht in den Papierkorb.",
      );
    databaseError(error);
  }
  return NextResponse.json({ row: data });
});
