"use client";

import React from "react";
import { motion } from "framer-motion";

interface FormProgressBarProps {
  pct: number;
  color?: string;
  height?: number;
}

export const FormProgressBar = React.memo(function FormProgressBar({
  pct,
  color = "var(--primary)",
  height = 3,
}: FormProgressBarProps) {
  return (
    <div
      className="w-full overflow-hidden flex-shrink-0"
      style={{ height, background: "rgba(255,255,255,0.08)" }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progresso do formulário: ${pct}%`}
    >
      <motion.div
        className="h-full"
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ background: color }}
      />
    </div>
  );
});
