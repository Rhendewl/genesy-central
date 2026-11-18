import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function siteAnalyticsContext() {
  const db = await createServerSupabaseClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profiles } = await db.from("user_profiles").select("owner_id,role,is_active").eq("auth_user_id", user.id);
  const active = (profiles ?? []).filter(row => row.is_active);
  const profile = active.find(row => row.owner_id !== user.id) ?? active[0];
  const ownerId = profile?.owner_id ?? user.id;
  const canManage = ownerId === user.id || profile?.role === "admin";
  return { db, user, ownerId, canManage };
}

