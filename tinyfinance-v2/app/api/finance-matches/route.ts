import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { amount } from "@/lib/modules";
import { databaseError } from "@/lib/errors";
import { route, jsonBody } from "@/lib/http";
export const POST = route(async (req: NextRequest) => {
  const a = await getContext("write");
  const body = z
    .discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("platform"),
          transaction_id: z.string().uuid(),
          settlement_id: z.string().uuid(),
          amount: amount,
        })
        .strict(),
      z
        .object({
          kind: z.literal("transfer"),
          debit_transaction_id: z.string().uuid(),
          credit_transaction_id: z.string().uuid(),
        })
        .strict(),
    ])
    .parse(await jsonBody(req));
  const result =
    body.kind === "platform"
      ? await a.client.rpc("confirm_settlement_match", {
          org: a.org,
          transaction_id: body.transaction_id,
          settlement: body.settlement_id,
          matched_amount: body.amount,
        })
      : await a.client.rpc("confirm_bank_transfer", {
          org: a.org,
          debit_transaction: body.debit_transaction_id,
          credit_transaction: body.credit_transaction_id,
        });
  if (result.error) databaseError(result.error);
  return NextResponse.json({ id: result.data });
});
export const DELETE = route(async (req: NextRequest) => {
  const a = await getContext("write");
  const body = z
    .object({ id: z.string().uuid(), kind: z.enum(["platform", "transfer"]) })
    .strict()
    .parse(await jsonBody(req));
  const { error } = await a.client.rpc("reject_finance_match", {
    org: a.org,
    match_id: body.id,
    kind: body.kind,
  });
  if (error) databaseError(error);
  return NextResponse.json({ ok: true });
});
