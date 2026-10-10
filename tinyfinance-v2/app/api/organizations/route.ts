import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { currentUser } from "@/lib/supabase";
import { AppError, databaseError } from "@/lib/errors";
import { route, jsonBody } from "@/lib/http";
export const POST = route(async (req: NextRequest) => {
  const { client, user } = await currentUser();
  if (!user) throw new AppError(401, "Bitte anmelden.");
  const raw = await jsonBody(req);
  let id: string;
  if (raw.id) {
    id = z.object({ id: z.string().uuid() }).strict().parse(raw).id;
    const { data, error } = await client
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", id)
      .maybeSingle();
    if (error) databaseError(error);
    if (!data) throw new AppError(403, "Kein Zugriff auf diesen Mandanten.");
  } else {
    const body = z
      .object({ name: z.string().trim().min(1).max(120) })
      .strict()
      .parse(raw);
    const { data, error } = await client.rpc("create_organization", {
      org_name: body.name,
    });
    if (error) databaseError(error);
    id = data;
  }
  (await cookies()).set("tf-organization", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true });
});
