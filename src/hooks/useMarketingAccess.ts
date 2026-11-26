"use client";

import { useCallback } from "react";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { canAccess, firstMarketingHome, isInstagramOwnScoped } from "@/lib/module-permissions";

// Acesso aos submódulos e abas do Marketing a partir de user_profiles.permissions.
// O servidor aplica as mesmas regras; aqui é só para esconder o que não cabe.
export function useMarketingAccess() {
  const { member, isOwner, isLoading } = useCurrentMember();
  const isAdmin = isOwner === true || member?.role === "admin";
  const permissions = member?.permissions;
  const can = useCallback(
    (key: string) => !isLoading && canAccess(permissions, key, isAdmin),
    [isAdmin, isLoading, permissions],
  );
  return {
    can,
    isLoading,
    isAdmin,
    ownInstagramOnly: !isLoading && isInstagramOwnScoped(permissions, isAdmin),
    home: isLoading ? null : firstMarketingHome(permissions, isAdmin),
  };
}
