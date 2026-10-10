import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { amount } from "@/lib/modules";
import { databaseError } from "@/lib/errors";
import { route, jsonBody } from "@/lib/http";
export const POST = route(async (req: NextRequest) => {
  const a = await getContext("write");
  const body = z
    .object({
      transaction_id: z.string().uuid(),
      document_id: z.string().uuid(),
      amount: amount.refine((v) => Number(v) > 0),
    })
    .strict()
    .parse(await jsonBody(req));
  const { data, error } = await a.client.rpc("confirm_bank_match", {
    org: a.org,
    transaction_id: body.transaction_id,
    doc_id: body.document_id,
    matched_amount: body.amount,
  });
  if (error) databaseError(error);
  return NextResponse.json({ id: data });
});
export const DELETE = route(async (req: NextRequest) => {
  const a = await getContext("write");
  const body = z
    .object({ id: z.string().uuid() })
    .strict()
    .parse(await jsonBody(req));
  const { error } = await a.client.rpc("reject_bank_match", {
    org: a.org,
    match_id: body.id,
  });
  if (error) databaseError(error);
  return NextResponse.json({ ok: true });
});
