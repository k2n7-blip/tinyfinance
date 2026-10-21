import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next =
    req.nextUrl.searchParams.get("next") === "/reset-password"
      ? "/reset-password"
      : "/dashboard";
  if (code) {
    try {
      const s = await supabaseServer();
      const { error } = await s.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, req.url));
    } catch {}
  }
  return NextResponse.redirect(new URL("/login?error=recovery", req.url));
}
