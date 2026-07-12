// Escala de cor semântica pro progresso de tarefas/objetivos: vermelho (0%) →
// laranja → amarelo → verde (100%). Usada pelos gauges do Workspace
// (HalfDonutGauge no Dashboard Geral, ProgressRing no Dashboard do Workspace
// e nos cards de Objetivo) para que a cor comunique o quão perto da conclusão
// o usuário está, não só o número. A cor da ponta (progressColor) é a mesma
// nos dois temas; só o início do gradiente muda — ver progressGradientFrom.
const STOPS: Array<{ pct: number; rgb: [number, number, number] }> = [
  { pct: 0,   rgb: [239, 68, 68]  },  // red-500
  { pct: 33,  rgb: [249, 115, 22] },  // orange-500
  { pct: 66,  rgb: [234, 179, 8]  },  // yellow-500
  { pct: 100, rgb: [34, 197, 94]  },  // green-500
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function progressColor(percent: number): string {
  const p = Math.max(0, Math.min(100, percent));
  let lo = STOPS[0];
  let hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (p >= STOPS[i].pct && p <= STOPS[i + 1].pct) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }
  const t = (p - lo.pct) / (hi.pct - lo.pct || 1);
  const [r, g, b] = [0, 1, 2].map(i => Math.round(lerp(lo.rgb[i], hi.rgb[i], t)));
  return `rgb(${r}, ${g}, ${b})`;
}

// Ponta inicial do gradiente — mesma cor da ponta, só que puxada pra uma base
// neutra, pro efeito de profundidade em vez de uma cor sólida chapada.
// Dark: escurecida (mistura com preto). Light: clareada (mistura com branco)
// — escurecer no tema claro deixa a barra pesada/suja sobre o card branco.
export function progressGradientFrom(percent: number, theme: "dark" | "light" = "dark"): string {
  const color = progressColor(percent);
  return theme === "light"
    ? `color-mix(in srgb, ${color} 28%, white)`
    : `color-mix(in srgb, ${color} 55%, black)`;
}
