"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PerformanceDashboard } from "@/components/performance/PerformanceDashboard";
import { useCurrentMember } from "@/context/CurrentMemberContext";

export default function PerformancePage() {
  const { member, isOwner, isLoading } = useCurrentMember();
  const hasAccess = isOwner === true || member?.permissions.includes("performance");

  return (
    <div className="dashboard-geral-bg">
      <div className="mx-auto max-w-7xl space-y-5 px-4 pb-28 sm:px-6">
        <Header
          title="Performance"
          subtitle="Gestão inteligente da equipe"
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {isLoading ? (
            <div className="lc-card h-72 animate-pulse" style={{ background: "var(--glass-bg-soft)" }} />
          ) : hasAccess ? (
            <PerformanceDashboard />
          ) : (
            <div className="lc-card p-8 text-center" style={{ background: "var(--glass-bg-soft)" }}>
              <AlertTriangle className="mx-auto mb-3" size={28} style={{ color: "#d97706" }} />
              <h2 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Acesso restrito</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                Você não tem permissão para acessar o módulo de Performance.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
