"use client";

import { motion } from "framer-motion";

// Compartilhado: usado por ObjectiveCard/ObjectiveDetailPanel agora, e pelo
// futuro Dashboard do Workspace ("Progresso das Tarefas"/"Objetivos").
interface ProgressBarProps {
  percent:     number; // 0-100
  showLabel?:  boolean;
}

export function ProgressBar({ percent, showLabel = true }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #26292e 0%, #b0b8c1 100%)" }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      {showLabel && (
        <span className="w-9 flex-shrink-0 text-right text-[11px] font-semibold tabular-nums" style={{ color: "var(--muted-foreground)" }}>
          {clamped}%
        </span>
      )}
    </div>
  );
}
