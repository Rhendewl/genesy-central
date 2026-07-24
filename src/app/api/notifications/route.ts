import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  lead_id: string | null;
  automation_id: string | null;
  source: string;
  task_id: string | null;
  action_url: string | null;
};

async function getCurrentProfileId() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, profileId: null, error: "Não autenticado", status: 401 };

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("id, owner_id, is_active")
    .eq("auth_user_id", user.id);

  if (error) return { supabase, profileId: null, error: error.message, status: 500 };
  const activeProfiles = (profiles ?? []).filter(profile => profile.is_active);
  const profile = activeProfiles.find(profile => profile.owner_id !== user.id) ?? activeProfiles[0];
  if (!profile?.id) return { supabase, profileId: null, error: "Perfil não encontrado", status: 404 };

  return { supabase, profileId: profile.id as string, error: null, status: 200 };
}

export async function GET(req: NextRequest) {
  const { supabase, profileId, error, status } = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ error }, { status });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 50);

  const [{ data, error: listError }, { count, error: countError }] = await Promise.all([
    supabase
      .from("workflow_notifications")
      .select("id, title, body, read_at, created_at, lead_id, automation_id, source, task_id, action_url")
      .eq("recipient_user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("workflow_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", profileId)
      .is("read_at", null),
  ]);

  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  return NextResponse.json({
    notifications: (data as NotificationRow[]) ?? [],
    unreadCount: count ?? 0,
  });
}

export async function PATCH() {
  const { supabase, profileId, error, status } = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ error }, { status });

  const { error: updateError } = await supabase
    .from("workflow_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", profileId)
    .is("read_at", null);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const { supabase, profileId, error, status } = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ error }, { status });

  const { error: deleteError } = await supabase
    .from("workflow_notifications")
    .delete()
    .eq("recipient_user_id", profileId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
