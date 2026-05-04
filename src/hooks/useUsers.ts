"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";

// Importa e re-exporta as constantes do módulo neutro (sem "use client")
import type { UserRole } from "@/lib/roles";
export type { UserRole };
export {
  ROLE_LABELS,
  ROLE_COLORS,
  ROLE_DEFAULT_PERMISSIONS,
  ALL_MODULES,
} from "@/lib/roles";

export interface UserProfile {
  id: string;
  owner_id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role: UserRole;
  job_title: string | null;
  is_active: boolean;
  avatar_url: string | null;
  last_seen_at: string | null;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface UserInvite {
  id: string;
  owner_id: string;
  email: string;
  role: UserRole;
  status: "pending" | "accepted" | "revoked";
  invited_by: string;
  expires_at: string;
  created_at: string;
}

export interface CreateUserPayload {
  full_name: string;
  email: string;
  role: UserRole;
  job_title: string;
  is_active: boolean;
  send_invite: boolean;
  permissions: string[];
}

export interface UpdateUserPayload {
  full_name: string;
  role: UserRole;
  job_title: string;
  is_active: boolean;
  permissions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useUsers() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [invites, setInvites]   = useState<UserInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const [profilesRes, invitesRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("user_invites")
          .select("*")
          .eq("owner_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (invitesRes.error)  throw invitesRes.error;

      setProfiles(
        (profilesRes.data ?? []).map((p) => ({
          ...p,
          permissions: Array.isArray(p.permissions) ? p.permissions : [],
        }))
      );
      setInvites(invitesRes.data ?? []);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Erro ao carregar usuários");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createUser = useCallback(async (payload: CreateUserPayload): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: "Não autenticado" };

      const { data, error: err } = await supabase
        .from("user_profiles")
        .insert({
          owner_id:    user.id,
          full_name:   payload.full_name,
          email:       payload.email,
          role:        payload.role,
          job_title:   payload.job_title || null,
          is_active:   payload.is_active,
          permissions: payload.permissions,
        })
        .select()
        .single();

      if (err) return { error: err.message };
      setProfiles(prev => [{ ...data, permissions: Array.isArray(data.permissions) ? data.permissions : [] }, ...prev]);

      if (payload.send_invite) {
        const { data: inviteData, error: invErr } = await supabase
          .from("user_invites")
          .insert({
            owner_id:   user.id,
            email:      payload.email,
            role:       payload.role,
            invited_by: user.id,
          })
          .select()
          .single();

        if (invErr) {
          return { error: `Convite não registrado: ${invErr.message}` };
        }

        const res = await fetch("/api/invite/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_id: inviteData.id }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // Usuário foi criado com sucesso mas o e-mail falhou — retorna aviso distinto
          return { error: `Usuário criado, mas o e-mail de convite falhou: ${body.error ?? "erro desconhecido"}` };
        }

        await fetchAll();
      }

      return { error: null };
    } catch (e: unknown) {
      return { error: (e as { message?: string })?.message ?? "Erro ao criar usuário" };
    }
  }, [fetchAll]);

  const updateUser = useCallback(async (id: string, payload: UpdateUserPayload): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { data, error: err } = await supabase
        .from("user_profiles")
        .update({
          full_name:   payload.full_name,
          role:        payload.role,
          job_title:   payload.job_title || null,
          is_active:   payload.is_active,
          permissions: payload.permissions,
        })
        .eq("id", id)
        .select()
        .single();

      if (err) throw err;
      setProfiles(prev => prev.map(p => (p.id === id
        ? { ...data, permissions: Array.isArray(data.permissions) ? data.permissions : [] }
        : p
      )));
      return { error: null };
    } catch (e: unknown) {
      return { error: (e as { message?: string })?.message ?? "Erro ao atualizar usuário" };
    }
  }, []);

  const toggleActive = useCallback(async (id: string, current: boolean): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { data, error: err } = await supabase
        .from("user_profiles")
        .update({ is_active: !current })
        .eq("id", id)
        .select()
        .single();

      if (err) throw err;
      setProfiles(prev => prev.map(p => (p.id === id
        ? { ...data, permissions: Array.isArray(data.permissions) ? data.permissions : [] }
        : p
      )));
      return { error: null };
    } catch (e: unknown) {
      return { error: (e as { message?: string })?.message ?? "Erro ao alterar status" };
    }
  }, []);

  const deleteUser = useCallback(async (id: string): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { error: err } = await supabase.from("user_profiles").delete().eq("id", id);
      if (err) throw err;
      setProfiles(prev => prev.filter(p => p.id !== id));
      return { error: null };
    } catch (e: unknown) {
      return { error: (e as { message?: string })?.message ?? "Erro ao remover usuário" };
    }
  }, []);

  const revokeInvite = useCallback(async (id: string): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { error: err } = await supabase
        .from("user_invites")
        .delete()
        .eq("id", id);
      if (err) throw err;
      setInvites(prev => prev.filter(i => i.id !== id));
      return { error: null };
    } catch (e: unknown) {
      return { error: (e as { message?: string })?.message ?? "Erro ao excluir convite" };
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email);
      if (err) throw err;
      return { error: null };
    } catch (e: unknown) {
      return { error: (e as { message?: string })?.message ?? "Erro ao enviar reset" };
    }
  }, []);

  const stats = {
    total:   profiles.length,
    active:  profiles.filter(p => p.is_active).length,
    pending: invites.length,
    admins:  profiles.filter(p => p.role === "admin").length,
  };

  return {
    profiles,
    invites,
    isLoading,
    error,
    stats,
    createUser,
    updateUser,
    toggleActive,
    deleteUser,
    revokeInvite,
    resetPassword,
    refetch: fetchAll,
  };
}
