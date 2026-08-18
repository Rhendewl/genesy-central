import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { isAdministrativeMember } from "@/lib/user-access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const LONG_BAN_DURATION = "876000h"; // 100 anos; "none" reativa a conta.

async function authorize(id: string) {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }

  const admin = createAdminSupabaseClient();
  const { data: requesterProfiles, error: requesterError } = await admin
    .from("user_profiles")
    .select("id, owner_id, auth_user_id, role, job_title, is_active")
    .eq("auth_user_id", user.id);

  if (requesterError) throw new Error(requesterError.message);
  const requester = (requesterProfiles ?? []).find((profile) => profile.is_active) ?? null;
  const isOwner = requester?.owner_id === user.id;
  if (!requester || !isAdministrativeMember(requester, isOwner)) {
    return { response: NextResponse.json({ error: "Acesso restrito a administradores ativos" }, { status: 403 }) };
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile || profile.owner_id !== requester.owner_id) {
    return { response: NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 }) };
  }
  if (profile.auth_user_id === user.id) {
    return { response: NextResponse.json({ error: "Você não pode desativar ou remover o próprio acesso" }, { status: 400 }) };
  }

  return { admin, profile };
}

async function setAuthAccess(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  authUserId: string,
  isActive: boolean,
) {
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    ban_duration: isActive ? "none" : LONG_BAN_DURATION,
  });
  if (error) throw new Error(error.message);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const authorization = await authorize(id);
    if ("response" in authorization) return authorization.response;

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (typeof body.full_name === "string" && body.full_name.trim()) update.full_name = body.full_name.trim();
    if (typeof body.role === "string") update.role = body.role;
    if (body.job_title === null || typeof body.job_title === "string") update.job_title = body.job_title || null;
    if (typeof body.is_active === "boolean") update.is_active = body.is_active;
    if (Array.isArray(body.permissions)) update.permissions = body.permissions;
    if (body.crm_pipeline_id === null || typeof body.crm_pipeline_id === "string") {
      update.crm_pipeline_id = body.crm_pipeline_id;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const { admin, profile } = authorization;
    const statusChanged = typeof update.is_active === "boolean" && update.is_active !== profile.is_active;
    const desiredActive = update.is_active as boolean;

    // Ao desativar, bloqueia primeiro a conta de autenticação. Ao ativar,
    // libera somente depois de o perfil voltar a estar ativo no banco.
    if (statusChanged && !desiredActive && profile.auth_user_id) {
      await setAuthAccess(admin, profile.auth_user_id, false);
    }

    const { data, error: updateError } = await admin
      .from("user_profiles")
      .update(update)
      .eq("id", profile.id)
      .select()
      .single();

    if (updateError) {
      if (statusChanged && !desiredActive && profile.auth_user_id) {
        await setAuthAccess(admin, profile.auth_user_id, true).catch(() => undefined);
      }
      throw new Error(updateError.message);
    }

    if (statusChanged && desiredActive && profile.auth_user_id) {
      try {
        await setAuthAccess(admin, profile.auth_user_id, true);
      } catch (error) {
        await admin.from("user_profiles").update({ is_active: false }).eq("id", profile.id);
        throw error;
      }
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar usuário" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const authorization = await authorize(id);
    if ("response" in authorization) return authorization.response;

    const { admin, profile } = authorization;
    if (profile.auth_user_id) {
      // Bloqueia primeiro: mesmo que a exclusão física da credencial seja
      // impedida por algum histórico relacionado, ela não voltará a logar.
      await setAuthAccess(admin, profile.auth_user_id, false);
    }

    const { error: deleteProfileError } = await admin
      .from("user_profiles")
      .delete()
      .eq("id", profile.id);
    if (deleteProfileError) {
      if (profile.auth_user_id) {
        await setAuthAccess(admin, profile.auth_user_id, true).catch(() => undefined);
      }
      throw new Error(deleteProfileError.message);
    }

    // Remoção é definitiva: elimina também a credencial de login.
    // Se houver uma referência histórica que impeça a exclusão física,
    // a conta permanece banida e sem perfil, portanto igualmente sem acesso.
    if (profile.auth_user_id) {
      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(profile.auth_user_id);
      if (deleteAuthError) {
        console.warn(`[users/${profile.id}] credencial mantida banida apó remoção:`, deleteAuthError.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao remover usuário" },
      { status: 500 },
    );
  }
}
