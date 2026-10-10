import { NextRequest, NextResponse } from "next/server";
import { getContext } from "@/lib/access";
import { allRows } from "@/lib/data";
import { moduleImport, importHeaders } from "@/lib/module-imports";
import { AppError, databaseError } from "@/lib/errors";
import { route } from "@/lib/http";
export const POST = route(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ module: string }> },
  ) => {
    const { module: key } = await params;
    if (!importHeaders[key]) throw new AppError(404, "Import nicht gefunden.");
    const a = await getContext(key === "time-entries" ? "payroll" : "write");
    if (Number(req.headers.get("content-length") || 0) > 2_500_000)
      throw new AppError(413, "Datei zu groß.");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 2_000_000)
      throw new AppError(400, "CSV-Datei bis 2 MB erforderlich.");
    const centers = await allRows(a.client, "cost_centers", a.org);
    const employees =
      key === "time-entries" ? await allRows(a.client, "employees", a.org) : [];
    const rows = moduleImport(await file.text(), key, centers, employees);
    const { data, error } = await a.client.rpc("import_records", {
      org: a.org,
      kind: key,
      rows,
    });
    if (error) databaseError(error);
    return NextResponse.json(data);
  },
);
export const GET = route(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ module: string }> },
  ) => {
    const { module: key } = await params;
    if (!importHeaders[key]) throw new AppError(404, "Import nicht gefunden.");
    await getContext(key === "time-entries" ? "payroll" : "read");
    return new Response("\uFEFF" + importHeaders[key].join(";") + "\r\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="tinyfinance-' + key + '-vorlage.csv"',
      },
    });
  },
);
