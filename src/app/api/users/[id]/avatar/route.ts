import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { isAdministrativeMember } from "@/lib/user-access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024;

async function authorize(id: string) {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };

  const { data: requester } = await sessionClient
    .from("user_profiles")
    .select("owner_id, role, job_title")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isOwner = requester ? requester.owner_id === user.id : true;
  if (!isAdministrativeMember(requester, isOwner)) {
    return { response: NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 }) };
  }

  const admin = createAdminSupabaseClient();
  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("id, owner_id, auth_user_id, avatar_url")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile || profile.owner_id !== (requester?.owner_id ?? user.id)) {
    return { response: NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 }) };
  }

  return { admin, profile };
}

function folderFor(profile: { id: string; auth_user_id: string | null }) {
  return profile.auth_user_id ?? `pending-${profile.id}`;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const authorization = await authorize(id);
    if ("response" in authorization) return authorization.response;

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecione uma imagem" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Use uma imagem PNG, JPG ou WebP" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB" }, { status: 400 });
    }

    const { admin, profile } = authorization;
    const folder = folderFor(profile);
    const { data: oldFiles } = await admin.storage.from("user-avatars").list(folder);
    if (oldFiles?.length) {
      await admin.storage.from("user-avatars").remove(oldFiles.map((item) => `${folder}/${item.name}`));
    }

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const storagePath = `${folder}/avatar.${extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("user-avatars")
      .upload(storagePath, bytes, { contentType: file.type, upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicData } = admin.storage.from("user-avatars").getPublicUrl(storagePath);
    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await admin
      .from("user_profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", profile.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar foto" },
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
    const folder = folderFor(profile);
    const { data: files } = await admin.storage.from("user-avatars").list(folder);
    if (files?.length) {
      const { error: removeError } = await admin.storage
        .from("user-avatars")
        .remove(files.map((item) => `${folder}/${item.name}`));
      if (removeError) throw new Error(removeError.message);
    }

    const { error: updateError } = await admin
      .from("user_profiles")
      .update({ avatar_url: null })
      .eq("id", profile.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ avatar_url: null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao remover foto" },
      { status: 500 },
    );
  }
}
