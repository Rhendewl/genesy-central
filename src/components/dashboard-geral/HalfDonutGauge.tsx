"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { progressColor, progressGradientFrom } from "@/lib/progress-color";
import { useGlobalStore } from "@/store";

// Gauge em meio-círculo estilo "dial" — arco preenchido com gradiente (escuro
// → cor final na ponta) + marcações (ticks) no restante não preenchido,
// como um velocímetro. Variação do ProgressRing (círculo cheio, usado no
// restante do Workspace) só para este painel específico do Dashboard Geral.
interface HalfDonutGaugeProps {
  percent:  number; // 0-100
  label:    string;
  caption:  string;
  size?:    number;
}

const TICK_COUNT = 24;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

export function HalfDonutGauge({ percent, label, caption, size = 116 }: HalfDonutGaugeProps) {
  const gradientId = useId().replace(/:/g, "");
  const theme = useGlobalStore(s => s.theme);
  const clamped = Math.max(0, Math.min(100, percent));
  const arcWidth      = 10;             // espessura (radial) do arco de progresso
  const tickLength     = arcWidth;      // comprimento de cada marcação = espessura do arco
  const tickThickness  = arcWidth / 4;  // espessura de cada marcação = 1/4 da espessura do arco
  const r  = (size - arcWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // 0% → 180° (esquerda), 100% → 0° (direita), varrendo por cima.
  const progressAngle = 180 - (clamped / 100) * 180;

  // `d` é sempre o arco completo (180°→0°, ou seja, 100%) — constante entre
  // renders. O progresso é animado via `pathLength` (framer-motion), não
  // recalculando a geometria a cada mudança — assim a transição entre valores
  // anima suavemente em vez de "saltar" para a nova posição.
  const start = polar(cx, cy, r, 180);
  const end   = polar(cx, cy, r, 0);
  const fullArcPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;

  const fromColor = progressGradientFrom(clamped, theme);
  const toColor   = progressColor(clamped);

  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => 180 - i * (180 / TICK_COUNT))
    .filter((angle) => angle < progressAngle - 1); // só a parte ainda não preenchida

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 + arcWidth }}>
        <svg width={size} height={size / 2 + arcWidth} viewBox={`0 0 ${size} ${size / 2 + arcWidth}`}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   style={{ stopColor: fromColor }} />
              <stop offset="100%" style={{ stopColor: toColor }} />
            </linearGradient>
          </defs>

          {/* Marcações (ticks) — só no trecho ainda não preenchido */}
          {ticks.map((angle) => {
            const inner = polar(cx, cy, r - tickLength / 2, angle);
            const outer = polar(cx, cy, r + tickLength / 2, angle);
            return (
              <line
                key={angle}
                x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="var(--border-card)"
                strokeWidth={tickThickness}
                strokeLinecap="butt"
              />
            );
          })}

          {/* Arco preenchido — gradiente escuro → cor final na ponta, ponta reta */}
          <motion.path
            d={fullArcPath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={arcWidth}
            strokeLinecap="butt"
            initial={false}
            animate={{ pathLength: clamped / 100 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </svg>

        {/* % centralizada dentro do semicírculo, não abaixo dele */}
        <div
          className="absolute inset-x-0 flex justify-center"
          style={{ top: "58%", transform: "translateY(-50%)" }}
        >
          <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-title)" }}>
            {Math.round(clamped)}%
          </p>
        </div>
      </div>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--silver)" }}>
        {label}
      </p>
      <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        {caption}
      </p>
    </div>
  );
}
