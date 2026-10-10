import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { extractDocument } from "@/lib/extraction";
import { route } from "@/lib/http";
export const POST = route(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const a = await getContext("write");
    const id = z
      .string()
      .uuid()
      .parse((await params).id);
    return NextResponse.json({
      row: await extractDocument(a.client, a.org, id),
      notice:
        "KI-Vorschlag gespeichert. Bitte mit dem Original vergleichen und ausdrücklich übernehmen.",
    });
  },
);
