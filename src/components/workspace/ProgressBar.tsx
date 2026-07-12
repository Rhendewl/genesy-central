"use client";

import { motion } from "framer-motion";
import { progressBandColor, progressBandGradientFrom } from "@/lib/progress-color";

// Compartilhado: usado por ObjectiveCard/ObjectiveDetailPanel agora, e pelo
// futuro Dashboard do Workspace ("Progresso das Tarefas"/"Objetivos").
interface ProgressBarProps {
  percent:     number; // 0-100
  showLabel?:  boolean;
  colorMode?:  "default" | "progress-band";
}

export function ProgressBar({ percent, showLabel = true, colorMode = "default" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const barBackground = colorMode === "progress-band"
    ? `linear-gradient(90deg, ${progressBandGradientFrom(clamped)} 0%, ${progressBandColor(clamped)} 100%)`
    : "linear-gradient(90deg, var(--workspace-progress-from) 0%, var(--workspace-progress-to) 100%)";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--glass-border)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: barBackground }}
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
