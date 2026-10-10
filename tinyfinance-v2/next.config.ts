import type { NextConfig } from "next";
if (
  process.env.VERCEL_ENV === "preview" &&
  process.env.TINYFINANCE_ENVIRONMENT !== "test"
)
  throw new Error(
    "Preview requires a separate test Supabase project and TINYFINANCE_ENVIRONMENT=test.",
  );
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (publicKey) {
  let role = "";
  try {
    role = JSON.parse(
      Buffer.from(publicKey.split(".")[1] || "", "base64url").toString(),
    ).role;
  } catch {}
  if (publicKey.startsWith("sb_secret_") || role === "service_role")
    throw new Error("Supabase service-role credentials must never be public.");
}
const config: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
