import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase server client
// Used in Server Components, Route Handlers, and middleware
// ─────────────────────────────────────────────────────────────────────────────

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — cookie writes are handled by middleware
          }
        },
      },
    }
  );
}
