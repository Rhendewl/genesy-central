"use client";

import { AlertTriangle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { AgentesBoard } from "@/components/agentes/AgentesBoard";
import { useCurrentMember } from "@/context/CurrentMemberContext";

export default function AgentesPage() {
  const { member, isOwner, isLoading } = useCurrentMember();
  const allowed = isOwner === true || member?.role === "admin";
  return (
    <div className="dashboard-geral-bg">
      <div className="mx-auto max-w-[1400px] space-y-5 px-4 pb-28 sm:px-6">
        <Header title="Agentes" subtitle="O Alfred e o Bruce trabalhando agora, do seu pedido até o que está no ar." />
        {isLoading ? (
          <div className="lc-card h-72 animate-pulse" />
        ) : allowed ? (
          <AgentesBoard />
        ) : (
          <div className="lc-card p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 text-amber-400" />
            <h2 className="font-bold">Acesso restrito</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>Os agentes são acompanhados por proprietários e administradores.</p>
          </div>
        )}
      </div>
    </div>
  );
}
