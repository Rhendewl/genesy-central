"use client";

import { useCurrentMember } from "@/context/CurrentMemberContext";

// Confere se o usuário logado tem um módulo habilitado em suas permissões
// (user_profiles.permissions) — mesma fonte já usada pra filtrar o menu
// (Dock.tsx/MobileNavigation.tsx) e os cards do Dashboard Geral.
export function useModuleAccess(moduleKey: string) {
  const { member, isOwner, isLoading } = useCurrentMember();
  const hasAccess = !isLoading && (isOwner === true || member?.role === "admin" || (member?.permissions.includes(moduleKey) ?? false));
  return { hasAccess, isLoading };
}
