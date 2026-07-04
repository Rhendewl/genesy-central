import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const MASKED = "__masked__";

// Returns all conversion sources owned by the user, regardless of pipeline.
// Agenda conversions can reuse any pixel the user has already configured in the CRM.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("platform_integrations")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sources = (data ?? []).map(row => ({ ...row, access_token: MASKED }));
  return NextResponse.json({ sources });
}
