// PATCH /api/profile/me — o usuário logado edita seu próprio perfil pessoal
// (nome/foto/cargo). Colunas privilegiadas (role/permissions/is_active/
// owner_id) são protegidas no banco pelo trigger
// protect_profile_privileged_columns, mesmo que alguém tente enviá-las aqui.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface UpdateMyProfileBody {
  full_name?:  string;
  job_title?:  string | null;
  avatar_url?: string | null;
  theme?:      "dark" | "light";
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as UpdateMyProfileBody | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.full_name === "string" && body.full_name.trim()) update.full_name = body.full_name.trim();
  if (body.job_title !== undefined)  update.job_title  = body.job_title;
  if (body.avatar_url !== undefined) update.avatar_url = body.avatar_url;
  if (body.theme === "dark" || body.theme === "light") update.theme = body.theme;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .update(update)
    .eq("auth_user_id", user.id)
    .select("id, owner_id, auth_user_id, full_name, email, role, job_title, is_active, avatar_url, permissions, theme")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
