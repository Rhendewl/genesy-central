"use client";

import { useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useCurrentMember } from "@/context/CurrentMemberContext";

export interface MyProfileUpdatePayload {
  full_name?:  string;
  job_title?:  string | null;
  avatar_url?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// useMyProfile — edição do perfil pessoal (nome/cargo/foto) do usuário
// logado, dono ou convidado. Le a partir de useCurrentMember(); salva via
// PATCH /api/profile/me, que reforça o allowlist de colunas editáveis
// (o banco também protege via trigger protect_profile_privileged_columns).
// ─────────────────────────────────────────────────────────────────────────────

export function useMyProfile() {
  const { member, isLoading, refetch } = useCurrentMember();
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(
    async (payload: MyProfileUpdatePayload): Promise<{ error: string | null }> => {
      try {
        setIsSaving(true);
        const res = await fetch("/api/profile/me", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { error: json.error ?? "Erro ao salvar perfil" };
        await refetch();
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao salvar perfil" };
      } finally {
        setIsSaving(false);
      }
    },
    [refetch]
  );

  const uploadAvatar = useCallback(
    async (file: File): Promise<{ url: string | null; error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { url: null, error: "Não autenticado" };

        const ext = file.name.split(".").pop() ?? "png";
        const path = `${user.id}/avatar.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("user-avatars")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadErr) return { url: null, error: uploadErr.message };

        const { data: urlData } = supabase.storage.from("user-avatars").getPublicUrl(path);

        const { error: saveError } = await save({ avatar_url: urlData.publicUrl });
        if (saveError) return { url: null, error: saveError };

        return { url: urlData.publicUrl, error: null };
      } catch (e: unknown) {
        return { url: null, error: e instanceof Error ? e.message : "Erro ao enviar foto" };
      }
    },
    [save]
  );

  // Apaga o(s) arquivo(s) do bucket (não só limpa o campo avatar_url) — evita
  // deixar a foto órfã no Storage depois que o usuário remove.
  const removeAvatar = useCallback(
    async (): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Não autenticado" };

        const { data: files, error: listErr } = await supabase.storage
          .from("user-avatars")
          .list(user.id);
        if (listErr) return { error: listErr.message };

        if (files && files.length > 0) {
          const paths = files.map(f => `${user.id}/${f.name}`);
          const { error: removeErr } = await supabase.storage.from("user-avatars").remove(paths);
          if (removeErr) return { error: removeErr.message };
        }

        const { error: saveError } = await save({ avatar_url: null });
        if (saveError) return { error: saveError };

        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao remover foto" };
      }
    },
    [save]
  );

  return { member, isLoading, isSaving, save, uploadAvatar, removeAvatar };
}
