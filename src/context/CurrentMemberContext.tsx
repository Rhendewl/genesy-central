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
  permissions: string[];
}

interface CurrentMemberContextValue {
  member: MemberProfile | null; // null → não é membro da equipe (é owner)
  isOwner: boolean | null;      // null → ainda carregando
  isLoading: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const CurrentMemberContext = createContext<CurrentMemberContextValue>({
  member: null,
  isOwner: null,
  isLoading: true,
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

    // Busca perfil onde auth_user_id = uid do usuário logado.
    // Retorna dados somente se este usuário é um membro da equipe de alguém.
    // RLS policy "user_profiles_member_select_own" permite este SELECT.
    const { data } = await supabase
      .from("user_profiles")
      .select(
        "id, owner_id, auth_user_id, full_name, email, role, job_title, is_active, permissions"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (data) {
      setMember({
        ...data,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
      });
      setIsOwner(false);
    } else {
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
    <CurrentMemberContext.Provider value={{ member, isOwner, isLoading }}>
      {children}
    </CurrentMemberContext.Provider>
  );
}

export function useCurrentMember() {
  return useContext(CurrentMemberContext);
}
