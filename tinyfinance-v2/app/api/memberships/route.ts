import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/access";
import { databaseError } from "@/lib/errors";
import { route, jsonBody } from "@/lib/http";
export const POST = route(async (req: NextRequest) => {
  const a = await getContext("admin");
  const b = z
    .object({
      user_id: z.string().uuid(),
      role: z.enum([
        "owner",
        "bookkeeper",
        "advisor_read",
        "advisor_review",
        "viewer",
      ]),
      private_access: z.boolean(),
      payroll_access: z.boolean(),
    })
    .strict()
    .parse(await jsonBody(req));
  const { error } = await a.client.rpc("set_membership", {
    org: a.org,
    member_id: b.user_id,
    member_role: b.role,
    allow_private: b.private_access,
    allow_payroll: b.payroll_access,
  });
  if (error) databaseError(error);
  return NextResponse.json({ ok: true });
});
export const DELETE = route(async (req: NextRequest) => {
  const a = await getContext("admin");
  const b = z
    .object({ user_id: z.string().uuid() })
    .strict()
    .parse(await jsonBody(req));
  const { error } = await a.client.rpc("revoke_membership", {
    org: a.org,
    member_id: b.user_id,
  });
  if (error) databaseError(error);
  return NextResponse.json({ ok: true });
});
