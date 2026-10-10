import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AppError } from "./errors";

export async function supabaseServer() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    throw new AppError(503, "Supabase-Konfiguration fehlt.", "configuration");
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          items: {
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }[],
        ) {
          try {
            items.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components können Cookies nicht immer setzen.
          }
        },
      },
    },
  );
}

export async function currentUser() {
  const client = await supabaseServer();

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    return { client, user: null };
  }

  return { client, user };
}
