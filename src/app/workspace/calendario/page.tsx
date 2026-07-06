"use client";

import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { AgendaSemanalPanel } from "@/components/agenda/AgendaSemanalPanel";

// Reaproveita exatamente o mesmo painel de Agenda Semanal do Dashboard Geral —
// mesmo comportamento, navegação, modal e desempenho. Nenhuma integração ou
// componente novo: só uma nova moldura de página dentro do Workspace.

export default function WorkspaceCalendarioPage() {
  return (
    <div className="flex min-h-screen flex-col pb-24">
      <Header title="Workspace" subtitle="Sua agenda, sincronizada com o Google Calendar" />

      <div className="px-4 sm:px-6">
        <motion.div
          className="lc-card p-5"
          style={{ background: "rgba(0,0,0,0.31)" }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <AgendaSemanalPanel />
        </motion.div>
      </div>
    </div>
  );
}
