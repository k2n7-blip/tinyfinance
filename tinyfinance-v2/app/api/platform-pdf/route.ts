import { NextRequest, NextResponse } from "next/server";
import { getDocumentProxy } from "unpdf";
import { orderedPdfText } from "@/lib/pdf-text";
import { getContext } from "@/lib/access";
import { allRows } from "@/lib/data";
import { AppError, databaseError } from "@/lib/errors";
import { route, jsonBody } from "@/lib/http";
import { holiduSettlement, holiduAccommodation } from "@/lib/platform-pdf";
import { z } from "zod";
import { modules } from "@/lib/modules";
export const runtime = "nodejs";
export const POST = route(async (req: NextRequest) => {
  const a = await getContext("write");
  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = await jsonBody(req);
    const rows = z
      .array(modules.platforms.schema)
      .min(1)
      .max(200)
      .parse(Array.isArray(body) ? body : [body]);
    if (rows.some((row) => row.status !== "draft"))
      throw new AppError(
        400,
        "PDF-Import muss als Entwurf gespeichert werden.",
      );
    const centers = await allRows(a.client, "cost_centers", a.org);
    if (
      rows.some(
        (row) =>
          !centers.some(
            (c) => c.id === row.cost_center_id && c.active !== false,
          ),
      )
    )
      throw new AppError(400, "Aktives Ferienhaus auswählen.");
    const { data, error } = await a.client.rpc("import_records", {
      org: a.org,
      kind: "platforms",
      rows,
    });
    if (error) databaseError(error);
    return NextResponse.json(data);
  }
  if (Number(req.headers.get("content-length") || 0) > 4_000_000)
    throw new AppError(413, "PDF bis 3 MB erforderlich.");
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || file.size > 3_000_000)
    throw new AppError(400, "PDF bis 3 MB erforderlich.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-")
    throw new AppError(400, "Keine gültige PDF-Datei.");
  let text: string;
  try {
    const document = await getDocumentProxy(bytes);
    text = await orderedPdfText(document);
  } catch {
    throw new AppError(
      400,
      "PDF nicht lesbar oder mehr als 20 Seiten. Bitte eine unverschlüsselte Text-PDF verwenden.",
    );
  }
  return NextResponse.json({
    suggestion: holiduSettlement(text),
    accommodation: holiduAccommodation(text),
    mappingScope: a.org + ":" + a.user.id,
    centers: await allRows(a.client, "cost_centers", a.org),
  });
});
