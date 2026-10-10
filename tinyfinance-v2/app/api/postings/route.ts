import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { date, postingSchema } from "@/lib/modules";
import { databaseError } from "@/lib/errors";
import { jsonBody, route } from "@/lib/http";
export const POST = route(async (req: NextRequest) => {
  const raw = await jsonBody(req);
  if (raw.action === "save") {
    const a = await getContext("write");
    const payload = postingSchema.parse(raw.payload);
    const { data, error } = await a.client.rpc("save_posting", {
      org: a.org,
      payload,
    });
    if (error) databaseError(error);
    return NextResponse.json({ id: data });
  }
  const a = await getContext("review");
  if (raw.action === "approve") {
    const body = z
      .object({
        action: z.literal("approve"),
        id: z.string().uuid(),
        version: z.number().int().positive(),
      })
      .strict()
      .parse(raw);
    const { error } = await a.client.rpc("approve_posting", {
      org: a.org,
      posting: body.id,
      expected_version: body.version,
    });
    if (error) databaseError(error);
  } else {
    const body = z
      .object({
        action: z.literal("reverse"),
        id: z.string().uuid(),
        date,
        reason: z.string().trim().min(1).max(60),
      })
      .strict()
      .parse(raw);
    const { error } = await a.client.rpc("reverse_posting", {
      org: a.org,
      posting: body.id,
      reversal_date: body.date,
      reason: body.reason,
    });
    if (error) databaseError(error);
  }
  return NextResponse.json({ ok: true });
});
