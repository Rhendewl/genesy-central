import { createBrowserClient } from "@supabase/ssr";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase browser client (singleton)
// Used in client components and hooks
// ─────────────────────────────────────────────────────────────────────────────

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Singleton for client-side use
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!client) {
    client = createClient();
  }
  return client;
}
