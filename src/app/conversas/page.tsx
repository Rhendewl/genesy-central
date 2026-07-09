"use client";

import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { ConversasModule } from "@/components/conversas/ConversasModule";

export default function ConversasPage() {
  return (
    <div className="dashboard-geral-bg">
      <div className="mx-auto max-w-7xl space-y-5 px-4 pb-28 sm:px-6">
        <Header
          title="Conversas"
          subtitle="WhatsApp, caixa de entrada da equipe e fluxos visuais"
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <ConversasModule />
        </motion.div>
      </div>
    </div>
  );
}
