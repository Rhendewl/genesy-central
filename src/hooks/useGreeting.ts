"use client";

import { useEffect, useState } from "react";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { getSupabaseClient } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// useGreeting — resolve saudação (Bom dia/Boa tarde/Boa noite) + nome do
// usuário logado, para o cabeçalho do Dashboard Geral.
//
// Prioridade do nome:
//   1. Membro de equipe → user_profiles.full_name (via useCurrentMember)
//   2. Dono da conta    → company_profile.owner_full_name (via useCompanyProfile)
//   3. Fallback         → parte antes do "@" do e-mail autenticado
// ─────────────────────────────────────────────────────────────────────────────

function periodGreeting(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function useGreeting() {
  const { member, isOwner, isLoading: memberLoading } = useCurrentMember();
  const { profile, isLoading: profileLoading } = useCompanyProfile();
  const [emailFallback, setEmailFallback] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? null;
      setEmailFallback(email ? email.split("@")[0] : null);
    });
  }, []);

  const isLoading = memberLoading || (isOwner === true && profileLoading);

  let name: string | null = null;
  if (member?.full_name) {
    name = member.full_name;
  } else if (isOwner && profile?.owner_full_name) {
    name = profile.owner_full_name;
  } else if (emailFallback) {
    name = emailFallback;
  }

  return {
    greeting: periodGreeting(new Date().getHours()),
    name,
    isLoading,
  };
}
