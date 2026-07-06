"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getSupabaseClient } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberProfile {
  id: string;
  owner_id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role: string;
  job_title: string | null;
  is_active: boolean;
  avatar_url: string | null;
  permissions: string[];
}

interface CurrentMemberContextValue {
  member: MemberProfile | null; // linha de user_profiles do usuário logado (dono ou convidado)
  isOwner: boolean | null;      // null → ainda carregando
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const CurrentMemberContext = createContext<CurrentMemberContextValue>({
  member: null,
  isOwner: null,
  isLoading: true,
  refetch: async () => {},
});

export function CurrentMemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsOwner(null);
      setIsLoading(false);
      return;
    }

    // Busca perfil onde auth_user_id = uid do usuário logado. Desde a
    // migration 20260719_owner_self_profile, todo usuário — dono ou
    // convidado — tem exatamente uma linha aqui (o dono tem uma linha
    // auto-referente, owner_id = auth_user_id = seu próprio uid).
    // RLS policy "user_profiles_member_select_own" permite este SELECT.
    const { data } = await supabase
      .from("user_profiles")
      .select(
        "id, owner_id, auth_user_id, full_name, email, role, job_title, is_active, avatar_url, permissions"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (data) {
      setMember({
        ...data,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
      });
      setIsOwner(data.auth_user_id === data.owner_id);
    } else {
      // Fallback defensivo — conta ainda não migrada (não deveria acontecer
      // após 20260719_owner_self_profile.sql rodar).
      setMember(null);
      setIsOwner(true);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();

    // Atualiza quando a sessão muda (login/logout)
    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setIsLoading(true);
      load();
    });

    return () => subscription.unsubscribe();
  }, [load]);

  return (
    <CurrentMemberContext.Provider value={{ member, isOwner, isLoading, refetch: load }}>
      {children}
    </CurrentMemberContext.Provider>
  );
}

export function useCurrentMember() {
  return useContext(CurrentMemberContext);
}
