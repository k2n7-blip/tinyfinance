import { NextRequest } from "next/server";
import { getContext } from "@/lib/access";
import { modules } from "@/lib/modules";
import { AppError } from "@/lib/errors";
import { allRows } from "@/lib/data";
import { csvCell } from "@/lib/money";
import { route } from "@/lib/http";
export const GET = route(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ module: string }> },
  ) => {
    const { module: key } = await params;
    const mod = modules[key];
    if (!mod) throw new AppError(404, "Modul nicht gefunden.");
    const a = await getContext(mod.scope === "admin" ? "read" : mod.scope);
    const data = await allRows(a.client, mod.table, a.org);
    const csv =
      "\uFEFF" +
      mod.fields.map((f) => csvCell(f.label)).join(";") +
      "\r\n" +
      data
        .map((r) => mod.fields.map((f) => csvCell(r[f.key])).join(";"))
        .join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="tinyfinance-' + key + '.csv"',
      },
    });
  },
);
