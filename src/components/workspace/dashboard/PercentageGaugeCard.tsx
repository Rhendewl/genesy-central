"use client";

import { motion } from "framer-motion";
import { ProgressRing } from "@/components/workspace/ProgressRing";

interface PercentageGaugeCardProps {
  title:    string;
  percent:  number;
  caption:  string;
  delay?:   number;
  /** Quando true, não desenha o próprio card de vidro — usado ao aninhar
   * este componente dentro de outro card (ex: painel resumo do Workspace
   * no Dashboard Geral), evitando "card dentro de card". */
  bare?:    boolean;
}

export function PercentageGaugeCard({ title, percent, caption, delay = 0, bare = false }: PercentageGaugeCardProps) {
  return (
    <motion.div
      className={bare ? "flex items-center gap-3" : "lc-card flex items-center gap-4 p-5"}
      style={bare ? undefined : { background: "rgba(0,0,0,0.31)" }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <ProgressRing percent={percent} size={bare ? 52 : 64} strokeWidth={bare ? 4 : 5} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-tight" style={{ color: "#b4b4b4" }}>
          {title}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          {caption}
        </p>
      </div>
    </motion.div>
  );
}
