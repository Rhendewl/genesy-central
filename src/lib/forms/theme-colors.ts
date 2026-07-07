import type { FormTheme } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// resolveThemeColors — deriva as cores efetivas (fundo claro/escuro, texto,
// bordas, cor principal) a partir do tema de um formulário. Extraído de
// StepRenderer.tsx para ser reutilizado também pelo bloco Calendário
// (CalendarStepField), que precisa seguir o mesmo tema — não seu próprio
// esquema de cores fixo.
// ─────────────────────────────────────────────────────────────────────────────

export function isLightBg(bg?: string): boolean {
  if (!bg || bg.startsWith("var(")) return false;
  const hex = bg.replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
  if (full.length !== 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

/** Escurece um hex em `amount` (0-1). Cores não-hex (ex. "var(...)") voltam
 *  inalteradas — quem chama decide o fallback nesse caso. */
export function darkenHex(hex: string, amount: number): string {
  if (!hex || hex.startsWith("var(")) return hex;
  const clean = hex.replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
  if (full.length !== 6) return hex;
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  const r = parseInt(full.slice(0, 2), 16) * (1 - amount);
  const g = parseInt(full.slice(2, 4), 16) * (1 - amount);
  const b = parseInt(full.slice(4, 6), 16) * (1 - amount);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export interface ResolvedThemeColors {
  primary:   string;
  light:     boolean;
  textColor: string;
  muted:     string;
  cardBg:    string;
  borderC:   string;
  /** Fundo de widgets "em destaque" (ex. bloco Calendário) — sempre um pouco
   *  mais escuro que o fundo configurado no formulário, mesmo que o fundo
   *  seja claro ou escuro. */
  widgetBg:  string;
}

export function resolveThemeColors(theme?: Partial<FormTheme>): ResolvedThemeColors {
  const primary = theme?.primaryColor ?? "var(--primary)";
  const light   = isLightBg(theme?.backgroundColor);
  // textColor explícito do tema tem prioridade sobre detecção de luminosidade
  const textColor = theme?.textColor ?? (light ? "#111827" : "var(--text-title)");
  const muted   = light ? "#6b7280"          : "var(--muted-foreground)";
  const cardBg  = light ? "rgba(0,0,0,0.04)" : "var(--card)";
  const borderC = light ? "rgba(0,0,0,0.12)" : "var(--border)";
  const widgetBg = theme?.backgroundColor && !theme.backgroundColor.startsWith("var(")
    ? darkenHex(theme.backgroundColor, 0.08)
    : cardBg;
  return { primary, light, textColor, muted, cardBg, borderC, widgetBg };
}
