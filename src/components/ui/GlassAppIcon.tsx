"use client";

import { CalendarDays, ClipboardList, NotebookPen } from "lucide-react";

export type GlassAppIconKind = "notes" | "forms" | "calendar";

type GlassAppIconProps = {
  kind: GlassAppIconKind;
  color?: string | null;
  className?: string;
};

const ICONS = { notes: NotebookPen, forms: ClipboardList, calendar: CalendarDays } as const;

/**
 * Ícone em vidro (inspirado no GlassIcons do React Bits, versão leve só com CSS):
 * um cartão colorido deslocado atrás de uma placa de vidro fosco com o símbolo.
 * A cor do cartão é a cor escolhida pelo usuário para a pasta/agenda.
 */
export function GlassAppIcon({ kind, color, className = "h-20 w-20" }: GlassAppIconProps) {
  const Icon = ICONS[kind];
  return (
    <span
      className={`glass-app-icon ${className}`}
      style={{ "--gai-color": color || "#8fa4bb" } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="glass-app-icon__box">
        <span className="glass-app-icon__plate" />
        <span className="glass-app-icon__glass" />
        <span className="glass-app-icon__face">
          <Icon strokeWidth={1.7} />
        </span>
      </span>
    </span>
  );
}
