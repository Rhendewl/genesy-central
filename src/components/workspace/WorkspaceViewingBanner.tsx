"use client";

import { Users, X } from "lucide-react";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";

// Deixa explícito, em qualquer página do Workspace, que o admin está atuando
// em nome de um colega — evita ambiguidade sobre onde uma edição está indo.
export function WorkspaceViewingBanner() {
  const { viewingMember, setViewingMember } = useWorkspaceViewing();
  if (!viewingMember) return null;

  return (
    <div
      className="mx-4 mt-3 flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm sm:mx-6"
      style={{ background: "rgba(224,163,68,0.10)", border: "1px solid rgba(224,163,68,0.25)" }}
    >
      <Users size={14} style={{ color: "#e0a344" }} />
      <span style={{ color: "#e0a344" }}>
        Visualizando o Workspace de <strong>{viewingMember.full_name}</strong>
      </span>
      <button
        onClick={() => setViewingMember(null)}
        className="ml-auto flex items-center gap-1 text-xs transition-colors hover:text-[var(--text-title)]"
        style={{ color: "rgba(224,163,68,0.7)" }}
      >
        <X size={12} />
        Voltar ao meu Workspace
      </button>
    </div>
  );
}
