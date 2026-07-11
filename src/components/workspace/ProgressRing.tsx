"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { progressColor, progressColorDark } from "@/lib/progress-color";

// Anel de progresso circular ("activity ring") — versão mais gamificada do
// ProgressBar, usada nos cards de Objetivos. Ao chegar em 100%, o anel muda
// para um tom de conclusão e ganha um brilho pulsante sutil (sem confete/
// efeitos infantis — mantém o acabamento premium do resto da plataforma).
interface ProgressRingProps {
  percent:     number; // 0-100
  size?:       number;
  strokeWidth?: number;
}

export function ProgressRing({ percent, size = 56, strokeWidth = 5 }: ProgressRingProps) {
  const clamped   = Math.max(0, Math.min(100, Math.round(percent)));
  const isComplete = clamped >= 100;
  const radius    = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset    = circumference * (1 - clamped / 100);
  const gradientId = `progress-ring-grad-${size}-${strokeWidth}`;
  const fromColor = progressColorDark(clamped);
  const toColor   = progressColor(clamped);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {isComplete && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: toColor }}
          initial={{ opacity: 0.35, scale: 1 }}
          animate={{ opacity: 0, scale: 1.35 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   style={{ stopColor: fromColor }} />
            <stop offset="100%" style={{ stopColor: toColor }} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-card)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        {isComplete ? (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
            <Check size={size * 0.32} color={toColor} strokeWidth={3} />
          </motion.div>
        ) : (
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--text-title)" }}>
            {clamped}%
          </span>
        )}
      </div>
    </div>
  );
}
