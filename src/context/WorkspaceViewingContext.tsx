"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { UserProfile } from "@/hooks/useUsers";

// ─────────────────────────────────────────────────────────────────────────────
// WorkspaceViewingContext — Painel "Equipe" do Administrador.
//
// viewingMember === null   → "Meu Workspace" (o próprio usuário logado)
// viewingMember !== null   → admin visualizando o Workspace desse colega
//
// A segurança de quem pode ver o quê é decidida no banco (RLS, via
// is_admin_of_user) — este contexto só guarda a escolha de UI de "em nome de
// quem" as páginas do Workspace devem buscar/criar dados agora.
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceViewingContextValue {
  viewingMember:    UserProfile | null;
  setViewingMember: (member: UserProfile | null) => void;
}

const WorkspaceViewingContext = createContext<WorkspaceViewingContextValue>({
  viewingMember:    null,
  setViewingMember: () => {},
});

export function WorkspaceViewingProvider({ children }: { children: ReactNode }) {
  const [viewingMember, setViewingMember] = useState<UserProfile | null>(null);

  return (
    <WorkspaceViewingContext.Provider value={{ viewingMember, setViewingMember }}>
      {children}
    </WorkspaceViewingContext.Provider>
  );
}

export function useWorkspaceViewing() {
  return useContext(WorkspaceViewingContext);
}
