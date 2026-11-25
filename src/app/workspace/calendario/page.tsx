"use client";

import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { AgendaSemanalPanel } from "@/components/agenda/AgendaSemanalPanel";

// Reaproveita exatamente o mesmo painel de Agenda Semanal do Dashboard Geral —
// mesmo comportamento, navegação, modal e desempenho. Nenhuma integração ou
// componente novo: só uma nova moldura de página dentro do Workspace.

export default function WorkspaceCalendarioPage() {
  return (
    <div className="flex flex-col pb-24">
      <div className="sr-only md:not-sr-only"><Header title="Workspace" subtitle="Sua agenda, sincronizada com o Google Calendar" /></div>

      <div className="px-4 sm:px-6">
        <motion.div
          className="lc-card h-auto p-3 md:p-5 sm:min-h-[440px]"
          style={{ background: "var(--glass-bg-soft)" }}
          initial={{ y: 18 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <AgendaSemanalPanel minRowHeight={120} mobileLayout="compact-grid" />
        </motion.div>
      </div>
    </div>
  );
}
