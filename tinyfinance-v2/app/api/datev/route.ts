import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { allRows } from "@/lib/data";
import { date } from "@/lib/modules";
import { datevFile } from "@/lib/datev";
import { csvCell } from "@/lib/money";
import { AppError, databaseError } from "@/lib/errors";
import { jsonBody, route } from "@/lib/http";
export const POST = route(async (req: NextRequest) => {
  const a = await getContext("review");
  const input = z
    .object({ from: date, to: date, test: z.boolean(), bundle: z.boolean() })
    .strict()
    .refine((v) => v.from <= v.to, "Ungültiger Zeitraum")
    .parse(await jsonBody(req));
  const { data: settings, error } = await a.client
    .from("finance_settings")
    .select("*")
    .eq("organization_id", a.org)
    .single();
  if (error) databaseError(error);
  if (!input.test && !settings.datev_test_import_confirmed)
    throw new AppError(
      409,
      "Zuerst Testimport vom Steuerberater bestätigen lassen. Testdateien verändern keinen Exportstatus.",
    );
  const [allPostings, allocations, accounts, docs, centers] = await Promise.all(
    [
      "postings",
      "posting_allocations",
      "chart_accounts",
      "documents",
      "cost_centers",
    ].map((t) => allRows(a.client, t, a.org)),
  );
  const postings = allPostings.filter(
    (p) =>
      p.status === "approved" &&
      p.posting_date >= input.from &&
      p.posting_date <= input.to,
  );
  const result = datevFile(
    settings,
    postings,
    allocations,
    accounts,
    docs,
    centers,
    input.from,
    input.to,
  );
  const manifest =
    "\uFEFF" +
    ["Buchungs-ID", "Beleg-ID", "Original", "Rechnungsnummer", "SHA-256"]
      .map(csvCell)
      .join(";") +
    "\r\n" +
    postings
      .map((p) => {
        const doc = docs.find((d) => d.id === p.document_id)!;
        return [
          p.id,
          doc.id,
          doc.original_filename,
          doc.invoice_number,
          doc.sha256,
        ]
          .map(csvCell)
          .join(";");
      })
      .join("\r\n");
  let bytes: Uint8Array<ArrayBuffer> = result.bytes;
  if (input.bundle) {
    const files: Record<string, Uint8Array> = {
      "EXTF_Buchungsstapel.csv": result.bytes,
      "Belegzuordnung.csv": strToU8(manifest),
    };
    let size = 0;
    const selectedDocs = docs.filter((d) =>
      postings.some((p) => p.document_id === d.id),
    );
    if (selectedDocs.length > 100)
      throw new AppError(
        413,
        "Ein Belegpaket darf höchstens 100 Originale enthalten. Zeitraum verkleinern.",
      );
    for (const doc of selectedDocs) {
      const { data, error: storageError } = await a.client.storage
        .from("documents")
        .download(doc.storage_path);
      if (storageError || !data)
        throw new AppError(502, "Belegpaket unvollständig: Original fehlt.");
      size += data.size;
      if (size > 100 * 1024 * 1024)
        throw new AppError(
          413,
          "Belegpaket überschreitet 100 MB. Zeitraum verkleinern.",
        );
      const original = new Uint8Array(await data.arrayBuffer());
      if (createHash("sha256").update(original).digest("hex") !== doc.sha256)
        throw new AppError(409, "Original-Prüfsumme stimmt nicht überein.");
      files[
        "Originale/" +
          doc.id +
          "/" +
          doc.original_filename.replace(/[^A-Za-z0-9._-]/g, "_")
      ] = original;
    }
    bytes = zipSync(files, { level: 1 });
  }
  let batchId = "";
  if (!input.test) {
    const { data, error: finalizeError } = await a.client.rpc(
      "finalize_export",
      {
        org: a.org,
        posting_ids: postings.map((p) => p.id),
        starts: input.from,
        ends: input.to,
        artifact: Buffer.from(result.bytes).toString("base64"),
        artifact_hash: createHash("sha256").update(result.bytes).digest("hex"),
      },
    );
    if (finalizeError) databaseError(finalizeError);
    batchId = data;
  }
  return new Response(bytes, {
    headers: {
      "Content-Type": input.bundle
        ? "application/zip"
        : "text/csv; charset=windows-1252",
      "Content-Disposition":
        'attachment; filename="' +
        (input.test ? "TEST_" : "") +
        "EXTF_TinyFinance." +
        (input.bundle ? "zip" : "csv") +
        '"',
      "X-TinyFinance-Export-ID": batchId,
      "X-TinyFinance-Rows": String(result.rows),
    },
  });
});
