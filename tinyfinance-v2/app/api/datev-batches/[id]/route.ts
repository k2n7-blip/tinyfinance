import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { AppError, databaseError } from "@/lib/errors";
import { route } from "@/lib/http";
export const GET = route(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const a = await getContext();
    const id = z
      .string()
      .uuid()
      .parse((await params).id);
    const { data, error } = await a.client
      .from("export_batches")
      .select("data_base64,file_sha256")
      .eq("organization_id", a.org)
      .eq("id", id)
      .maybeSingle();
    if (error) databaseError(error);
    if (!data) throw new AppError(404, "Export nicht gefunden.");
    const bytes = Buffer.from(data.data_base64, "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== data.file_sha256)
      throw new AppError(409, "Export-Prüfsumme stimmt nicht überein.");
    return new Response(bytes, {
      headers: {
        "Content-Type": "text/csv; charset=windows-1252",
        "Content-Disposition":
          'attachment; filename="EXTF_TinyFinance_' + id + '.csv"',
      },
    });
  },
);
