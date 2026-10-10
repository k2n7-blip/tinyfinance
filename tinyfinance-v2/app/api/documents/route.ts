import { allRows } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { AppError, databaseError } from "@/lib/errors";
import { route } from "@/lib/http";
export const GET = route(async (req: NextRequest) => {
  const a = await getContext();
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .parse(req.nextUrl.searchParams.get("page") || 0);
  const trash = req.nextUrl.searchParams.get("trash") === "1";
  const q = (req.nextUrl.searchParams.get("q") || "")
    .slice(0, 120)
    .toLowerCase();
  const status = req.nextUrl.searchParams.get("status");
  if (status) z.enum(["pending", "reviewed", "rejected"]).parse(status);
  const center = req.nextUrl.searchParams.get("center");
  if (center) z.string().uuid().parse(center);
  const rows = (await allRows(a.client, "documents", a.org, true))
    .filter(
      (d) =>
        !!d.discarded_at === trash &&
        (!q || String(d.original_filename).toLowerCase().includes(q)) &&
        (!status || d.review_status === status) &&
        (!center || d.cost_center_id === center),
    )
    .sort(
      (x, y) =>
        String(y.created_at).localeCompare(String(x.created_at)) ||
        String(x.id).localeCompare(String(y.id)),
    );
  return NextResponse.json({
    rows: rows.slice(page * 50, page * 50 + 50),
    total: rows.length,
    page,
  });
});
export const POST = route(async (req: NextRequest) => {
  const a = await getContext("write");
  if (Number(req.headers.get("content-length") || 0) > 42 * 1024 * 1024)
    throw new AppError(413, "Mehrfachupload: insgesamt maximal 40 MB.");
  const form = await req.formData();
  const files = form.getAll("file");
  if (files.length < 1 || files.length > 20)
    throw new AppError(400, "Bitte 1 bis 20 Belege auswählen.");
  const subject = form.get("tax_subject_id")
    ? z.string().uuid().parse(form.get("tax_subject_id"))
    : null;
  const center = form.get("cost_center_id")
    ? z.string().uuid().parse(form.get("cost_center_id"))
    : null;
  if (subject) {
    const { data } = await a.client
      .from("tax_subjects")
      .select("id")
      .eq("id", subject)
      .eq("organization_id", a.org)
      .maybeSingle();
    if (!data) throw new AppError(403, "Steuerbereich nicht zugänglich.");
  }
  if (center) {
    const { data } = await a.client
      .from("cost_centers")
      .select("id")
      .eq("id", center)
      .eq("organization_id", a.org)
      .eq("active", true)
      .maybeSingle();
    if (!data)
      throw new AppError(400, "Kostenstelle ist ungültig oder deaktiviert.");
  }
  if (
    files.reduce((s, f) => s + (f instanceof File ? f.size : 0), 0) >
    40 * 1024 * 1024
  )
    throw new AppError(413, "Insgesamt maximal 40 MB.");
  const results: {
    filename: string;
    id?: string;
    status: number;
    error?: string;
  }[] = [];
  for (const item of files) {
    if (!(item instanceof File)) {
      results.push({ filename: "", status: 400, error: "Ungültige Datei." });
      continue;
    }
    try {
      if (
        item.size === 0 ||
        item.size > 10 * 1024 * 1024 ||
        !["application/pdf", "image/png", "image/jpeg"].includes(item.type)
      )
        throw new AppError(400, "Nur PDF/JPG/PNG bis 10 MB.");
      const bytes = Buffer.from(await item.arrayBuffer());
      const valid =
        item.type === "application/pdf"
          ? bytes.subarray(0, 5).toString() === "%PDF-"
          : item.type === "image/png"
            ? bytes
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
      if (!valid)
        throw new AppError(
          400,
          "Dateiinhalt stimmt nicht mit dem Dateityp überein.",
        );
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      let { data: doc } = await a.client
        .from("documents")
        .select("*")
        .eq("organization_id", a.org)
        .eq("sha256", sha256)
        .maybeSingle();
      if (doc && doc.upload_status === "ready")
        throw new AppError(
          409,
          "Identische Datei bereits vorhanden oder Upload läuft. Falls im Papierkorb: dort wiederherstellen.",
        );
      if (!doc) {
        const id = randomUUID(),
          name =
            item.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "beleg";
        const { data, error } = await a.client
          .from("documents")
          .insert({
            id,
            organization_id: a.org,
            original_filename: item.name.slice(0, 200),
            storage_path: a.org + "/" + id + "/" + name,
            sha256,
            mime_type: item.type,
            cost_center_id: center,
            tax_subject_id: subject,
            upload_status: "uploading",
          })
          .select("*")
          .single();
        if (error) databaseError(error);
        doc = data;
      }
      let { error: uploadError } = await a.client.storage
        .from("documents")
        .upload(doc.storage_path, bytes, {
          contentType: item.type,
          upsert: false,
        });
      if (uploadError) {
        // Storage and PostgreSQL cannot share a transaction. Resume only if
        // the immutable object at this exact reserved path has the same hash.
        const { data: stored } = await a.client.storage
          .from("documents")
          .download(doc.storage_path);
        if (
          stored &&
          createHash("sha256")
            .update(Buffer.from(await stored.arrayBuffer()))
            .digest("hex") === sha256
        )
          uploadError = null;
      }
      if (uploadError) {
        await a.client
          .from("documents")
          .update({ upload_status: "failed" })
          .eq("id", doc.id)
          .eq("organization_id", a.org);
        throw new AppError(
          502,
          "Original konnte nicht gespeichert werden. Bitte Upload erneut versuchen.",
        );
      }
      const { error: readyError } = await a.client
        .from("documents")
        .update({ upload_status: "ready" })
        .eq("id", doc.id)
        .eq("organization_id", a.org);
      if (readyError) databaseError(readyError);
      results.push({ filename: item.name, id: doc.id, status: 201 });
    } catch (error) {
      results.push({
        filename: item.name,
        status: error instanceof AppError ? error.status : 500,
        error:
          error instanceof AppError ? error.message : "Upload fehlgeschlagen.",
      });
    }
  }
  if (results.length === 1 && results[0].status !== 201)
    return NextResponse.json(
      { error: results[0].error, results },
      { status: results[0].status },
    );
  return NextResponse.json(
    { results },
    { status: results.every((r) => r.status === 201) ? 201 : 207 },
  );
});
