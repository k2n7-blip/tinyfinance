import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase";
import { route } from "@/lib/http";
export const POST = route(async (req: NextRequest) => {
  const s = await supabaseServer();
  await s.auth.signOut();
  (await cookies()).delete("tf-organization");
  return NextResponse.redirect(new URL("/login", req.url), 303);
});
