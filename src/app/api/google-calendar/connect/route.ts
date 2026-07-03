// GET /api/google-calendar/connect
// Auth required. Generates the Google OAuth URL and redirects the user.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { signState }                  from "@/lib/crypto";
import { buildAuthorizationUrl }      from "@/lib/google-calendar/google-oauth-service";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const returnTo = req.nextUrl.searchParams.get("returnTo") ?? "/agendamentos";
  // Only allow same-origin paths to prevent open redirect
  const safeReturn = /^\/[a-zA-Z]/.test(returnTo) ? returnTo : "/agendamentos";

  const state   = signState({ userId: user.id, returnTo: safeReturn });
  const authUrl = buildAuthorizationUrl(state);

  return NextResponse.redirect(authUrl);
}
