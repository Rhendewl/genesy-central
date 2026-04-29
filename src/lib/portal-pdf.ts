// ─────────────────────────────────────────────────────────────────────────────
// portal-pdf.ts — PDF premium com fidelidade visual ao portal Genesy
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PortalKPIs, PortalDailyMetric, PortalCampaignSummary } from "@/types";

type RGB = [number, number, number];

// ── Palette (composited sobre #05070B) ────────────────────────────────────────
const BG:    RGB = [5,   7,   11];   // página
const HDR:   RGB = [8,   10,  16];   // header bar
const GLASS: RGB = [16,  18,  26];   // glassmorphism card
const GLASS2:RGB = [12,  14,  20];   // alternado / mais escuro
const GBDR:  RGB = [44,  46,  58];   // borda glass
const THDR:  RGB = [22,  24,  36];   // cabeçalho tabela
const SEP:   RGB = [28,  30,  42];   // separadores e grid
const WHITE: RGB = [255, 255, 255];
const MUTED: RGB = [108, 110, 126];
const DIM:   RGB = [55,  57,  70];

// Cores das métricas (consistente com portal)
const BLUE:   RGB = [39,  163, 255]; // investimento
const GREEN:  RGB = [34,  197, 94];  // leads
const ORANGE: RGB = [249, 115, 22];  // CPL
const PURPLE: RGB = [167, 139, 250]; // alcance
const CYAN:   RGB = [6,   182, 212]; // cliques
const YELLOW: RGB = [245, 158, 11];  // CTR

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ── Helpers jsPDF ─────────────────────────────────────────────────────────────
const fc = (p: jsPDF, c: RGB) => p.setFillColor(c[0], c[1], c[2]);
const dc = (p: jsPDF, c: RGB) => p.setDrawColor(c[0], c[1], c[2]);
const tc = (p: jsPDF, c: RGB) => p.setTextColor(c[0], c[1], c[2]);
const lw = (p: jsPDF, w: number) => p.setLineWidth(w);

// Mistura uma cor com o fundo para simular opacidade
function blend(color: RGB, alpha: number): RGB {
  return [
    Math.round(color[0] * alpha + BG[0] * (1 - alpha)),
    Math.round(color[1] * alpha + BG[1] * (1 - alpha)),
    Math.round(color[2] * alpha + BG[2] * (1 - alpha)),
  ];
}

// Área preenchida sob uma polilinha (glassmorphism-style area fill)
function drawAreaFill(
  pdf: jsPDF,
  pts: { x: number; y: number }[],
  bottomY: number,
  color: RGB,
  opacity: number,
) {
  if (pts.length < 2) return;
  const [r, g, b] = blend(color, opacity);
  pdf.setFillColor(r, g, b);
  const startX = pts[0].x;
  const startY = pts[0].y;
  const segments: number[][] = pts.slice(1).map((pt, i) => [
    pt.x - pts[i].x,
    pt.y - pts[i].y,
  ]);
  // Fechar área: descer ao fundo → voltar ao início → subir (via closed=true)
  segments.push([0, bottomY - pts[pts.length - 1].y]);
  segments.push([startX - pts[pts.length - 1].x, 0]);
  pdf.lines(segments, startX, startY, [1, 1], "F", true);
}

// Linha com glow (2 passes extras mais largas e suaves antes da linha principal)
function drawLine(
  pdf: jsPDF,
  pts: { x: number; y: number }[],
  color: RGB,
  width: number,
  glow = false,
  dash?: [number, number],
) {
  if (pts.length < 2) return;

  if (glow) {
    // Glow 1: amplo, muito suave
    dc(pdf, blend(color, 0.18));
    lw(pdf, width * 4.5);
    pdf.setLineDashPattern([], 0);
    for (let i = 1; i < pts.length; i++)
      pdf.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    // Glow 2: médio
    dc(pdf, blend(color, 0.35));
    lw(pdf, width * 2.2);
    for (let i = 1; i < pts.length; i++)
      pdf.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  }

  if (dash) pdf.setLineDashPattern([dash[0], dash[1]], 0);
  dc(pdf, color);
  lw(pdf, width);
  for (let i = 1; i < pts.length; i++)
    pdf.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  if (dash) pdf.setLineDashPattern([], 0);
}

// ── Interface pública ─────────────────────────────────────────────────────────
export interface PortalPDFData {
  portalName: string;
  clientName: string | null;
  periodLabel: string;
  since: string;
  until: string;
  kpis: PortalKPIs;
  daily: PortalDailyMetric[];
  campaigns: PortalCampaignSummary[];
}

// ── Gerador principal ─────────────────────────────────────────────────────────
export function generatePortalPDF(data: PortalPDFData): void {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W   = 210;
  const H   = 297;
  const PAD = 14;
  const CW  = W - PAD * 2;

  let y = 0;

  // ── Fundo escuro + glow radial simulado ────────────────────────────────────
  fc(pdf, BG);
  pdf.rect(0, 0, W, H, "F");

  // Glow radial no topo-centro: 4 elipses concêntricas decrescentes
  const glowColors: [number, number, number, number][] = [
    [8,  14, 35, 0.55],
    [7,  11, 28, 0.40],
    [6,   9, 20, 0.25],
    [5,   8, 15, 0.12],
  ];
  [[130, 70], [95, 50], [62, 32], [34, 16]].forEach(([rx, ry], gi) => {
    const [r, g, b] = glowColors[gi];
    pdf.setFillColor(r, g, b);
    pdf.ellipse(W / 2, 2, rx, ry, "F");
  });

  // ── Header bar ─────────────────────────────────────────────────────────────
  fc(pdf, HDR);
  pdf.rect(0, 0, W, 28, "F");
  dc(pdf, SEP);
  lw(pdf, 0.3);
  pdf.line(0, 28, W, 28);

  // Logo: "GENESY" bold branco
  tc(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12.5);
  pdf.text("GENESY", PAD, 12.5);

  // Separador "|" + nome do cliente
  const logoW = pdf.getTextWidth("GENESY");
  tc(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("|", PAD + logoW + 3.5, 12.5);
  tc(pdf, [185, 188, 200] as RGB);
  pdf.setFontSize(8.5);
  pdf.setFont("helvetica", "normal");
  pdf.text((data.clientName ?? data.portalName), PAD + logoW + 9, 12.5);

  // Datas (direita)
  const sinceStr = format(new Date(data.since + "T00:00:00"), "dd/MM/yyyy");
  const untilStr = format(new Date(data.until + "T00:00:00"), "dd/MM/yyyy");
  tc(pdf, BLUE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text(`${sinceStr} – ${untilStr}`, W - PAD, 11, { align: "right" });

  tc(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text(data.periodLabel, W - PAD, 19, { align: "right" });

  y = 36;

  // ── Helper: rótulo de seção ────────────────────────────────────────────────
  function sectionLabel(label: string) {
    tc(pdf, MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.text(label.toUpperCase(), PAD, y);
    dc(pdf, SEP);
    lw(pdf, 0.2);
    pdf.line(PAD + 46, y - 0.5, PAD + CW, y - 0.5);
    y += 7;
  }

  // ── Métricas (2 × 3) ──────────────────────────────────────────────────────
  sectionLabel("Métricas do Período");

  const metrics: { label: string; value: string; color: RGB }[] = [
    { label: "INVESTIMENTO", value: fmtBRL(data.kpis.investimento),                     color: BLUE   },
    { label: "LEADS",        value: fmtNum(data.kpis.leads),                            color: GREEN  },
    { label: "CPL",          value: data.kpis.leads > 0 ? fmtBRL(data.kpis.cpl) : "—", color: ORANGE },
    { label: "ALCANCE",      value: fmtNum(data.kpis.alcance),                          color: PURPLE },
    { label: "CLIQUES",      value: fmtNum(data.kpis.cliques),                          color: CYAN   },
    { label: "CTR",          value: fmtPct(data.kpis.ctr),                              color: YELLOW },
  ];

  const CARD_W = (CW - 4) / 3;
  const CARD_H = 22;
  const RR     = 2.5;

  metrics.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx  = PAD + col * (CARD_W + 2);
    const cy  = y + row * (CARD_H + 2.5);

    // Fundo glass
    fc(pdf, GLASS);
    pdf.roundedRect(cx, cy, CARD_W, CARD_H, RR, RR, "F");

    // Borda glass
    dc(pdf, GBDR);
    lw(pdf, 0.3);
    pdf.roundedRect(cx, cy, CARD_W, CARD_H, RR, RR, "S");

    // Linha superior colorida (acento da métrica)
    fc(pdf, m.color);
    pdf.rect(cx + RR, cy, CARD_W - RR * 2, 1.8, "F");
    // Preenche cantos superiores (sobre o roundedRect)
    pdf.rect(cx + RR, cy, CARD_W - RR * 2, RR, "F");
    pdf.roundedRect(cx, cy, CARD_W, RR * 2, RR, RR, "F");
    // Corta o excesso da parte inferior do acento
    fc(pdf, GLASS);
    pdf.rect(cx, cy + 1.8, CARD_W, RR, "F");
    // Redesenha acento limpo
    fc(pdf, m.color);
    pdf.rect(cx, cy, CARD_W, 1.8, "F");

    // Label
    tc(pdf, MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.text(m.label, cx + 4.5, cy + 10.5);

    // Valor
    tc(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(m.value, cx + 4.5, cy + 19.5);
  });

  y += 2 * (CARD_H + 2.5) + 10;

  // ── Gráfico de performance ─────────────────────────────────────────────────
  const hasDailyData =
    data.daily.length > 1 &&
    data.daily.some(d => d.investimento > 0 || d.leads > 0);

  if (hasDailyData) {
    sectionLabel("Performance no Período");

    const CH    = 46;          // chart height
    const AXISW = 13;          // espaço do eixo Y
    const CX    = PAD + AXISW; // chart X start
    const CTRW  = CW - AXISW;  // chart width
    const CBOT  = y + 8 + CH;  // y do eixo X

    // Card glass do gráfico
    fc(pdf, GLASS);
    pdf.roundedRect(PAD, y, CW, CH + 14, 2.5, 2.5, "F");
    dc(pdf, GBDR);
    lw(pdf, 0.25);
    pdf.roundedRect(PAD, y, CW, CH + 14, 2.5, 2.5, "S");

    // Grid horizontal
    dc(pdf, SEP);
    lw(pdf, 0.15);
    for (let g = 0; g <= 4; g++) {
      const gy = y + 8 + (CH / 4) * g;
      pdf.line(CX, gy, CX + CTRW, gy);
    }

    const n     = data.daily.length;
    const stepX = CTRW / Math.max(n - 1, 1);

    // ── Investimento (azul) ──
    const maxInv = Math.max(...data.daily.map(d => d.investimento), 1);
    const invPts = data.daily.map((d, i) => ({
      x: CX + i * stepX,
      y: y + 8 + CH - (d.investimento / maxInv) * CH,
    }));
    drawAreaFill(pdf, invPts, CBOT, BLUE, 0.12);
    drawLine(pdf, invPts, BLUE, 0.9, true);

    // ── Leads (verde) ──
    const maxLeads = Math.max(...data.daily.map(d => d.leads), 1);
    const ldPts = data.daily.map((d, i) => ({
      x: CX + i * stepX,
      y: y + 8 + CH - (d.leads / maxLeads) * CH,
    }));
    drawAreaFill(pdf, ldPts, CBOT, GREEN, 0.10);
    drawLine(pdf, ldPts, GREEN, 0.9, true);

    // ── CPL (laranja tracejado) ──
    const cplDays = data.daily.filter(d => d.cpl > 0);
    if (cplDays.length > 1) {
      const maxCpl = Math.max(...cplDays.map(d => d.cpl), 1);
      // Agrupa segmentos contíguos (evita linhas entre gaps)
      let seg: { x: number; y: number }[] = [];
      data.daily.forEach((d, i) => {
        if (d.cpl > 0) {
          seg.push({ x: CX + i * stepX, y: y + 8 + CH - (d.cpl / maxCpl) * CH });
        } else if (seg.length > 0) {
          drawLine(pdf, seg, ORANGE, 0.8, true, [1.8, 1.4]);
          seg = [];
        }
      });
      if (seg.length > 0) drawLine(pdf, seg, ORANGE, 0.8, true, [1.8, 1.4]);
    }

    // Labels eixo X
    tc(pdf, DIM);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.5);
    const step = Math.max(1, Math.floor(n / 8));
    data.daily.forEach((d, i) => {
      if (i % step === 0 || i === n - 1) {
        try {
          const lbl = format(new Date(d.data + "T00:00:00"), "dd/MM", { locale: ptBR });
          pdf.text(lbl, CX + i * stepX, CBOT + 8, { align: "center" });
        } catch { /* skip datas inválidas */ }
      }
    });

    // Legenda
    const lx = CX + CTRW - 82;
    const ly = y + 6.5;
    pdf.setFontSize(6);
    ([
      [BLUE,   "Investimento",  0],
      [GREEN,  "Leads",        31],
      [ORANGE, "CPL",          50],
    ] as [RGB, string, number][]).forEach(([color, lbl, offset]) => {
      fc(pdf, color);
      pdf.circle(lx + offset, ly, 1.1, "F");
      tc(pdf, MUTED);
      pdf.text(lbl, lx + offset + 3.2, ly + 0.9);
    });

    y += CH + 20;
  }

  // ── Funil ──────────────────────────────────────────────────────────────────
  sectionLabel("Funil de Performance");

  const funnelItems: { label: string; value: number; display: string; color: RGB }[] = [
    { label: "Alcance", value: data.kpis.alcance, display: fmtNum(data.kpis.alcance), color: PURPLE },
    { label: "Cliques", value: data.kpis.cliques, display: fmtNum(data.kpis.cliques), color: CYAN   },
    { label: "Leads",   value: data.kpis.leads,   display: fmtNum(data.kpis.leads),   color: GREEN  },
  ];

  const anchor  = Math.max(data.kpis.alcance, 1);
  const MAXBARW = CW - 44;
  const BARH    = 9.5;

  funnelItems.forEach(item => {
    const fillW = Math.max(12, (item.value / anchor) * MAXBARW);

    // Track glass
    fc(pdf, GLASS);
    pdf.roundedRect(PAD, y, CW, BARH, 1.8, 1.8, "F");
    dc(pdf, GBDR);
    lw(pdf, 0.25);
    pdf.roundedRect(PAD, y, CW, BARH, 1.8, 1.8, "S");

    // Fill (cor blendada com fundo)
    fc(pdf, blend(item.color, 0.28));
    pdf.roundedRect(PAD, y, fillW, BARH, 1.8, 1.8, "F");

    // Label colorido
    tc(pdf, item.color);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text(item.label, PAD + 5, y + 6.5);

    // Valor (direita)
    tc(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text(item.display, PAD + CW - 5, y + 6.5, { align: "right" });

    y += BARH + 3.5;
  });

  y += 9;

  // ── Tabela de campanhas ────────────────────────────────────────────────────
  const camps = data.campaigns.slice(0, 9);

  if (camps.length > 0) {
    sectionLabel("Campanhas");

    const cols = [
      { label: "Campanha", x: PAD,              w: CW * 0.37 },
      { label: "Status",   x: PAD + CW * 0.37,  w: CW * 0.13 },
      { label: "Invest.",  x: PAD + CW * 0.50,  w: CW * 0.17 },
      { label: "Leads",    x: PAD + CW * 0.67,  w: CW * 0.10 },
      { label: "CPL",      x: PAD + CW * 0.77,  w: CW * 0.23 },
    ];
    const ROW_H = 7.5;

    // Header
    fc(pdf, THDR);
    pdf.roundedRect(PAD, y, CW, ROW_H, 1.2, 1.2, "F");
    dc(pdf, GBDR);
    lw(pdf, 0.25);
    pdf.roundedRect(PAD, y, CW, ROW_H, 1.2, 1.2, "S");

    tc(pdf, MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    cols.forEach((col, ci) => {
      const right = ci >= 2;
      pdf.text(col.label, right ? col.x + col.w : col.x + 3, y + 5, { align: right ? "right" : "left" });
    });
    y += ROW_H;

    // Linhas
    camps.forEach((c, i) => {
      fc(pdf, i % 2 === 0 ? GLASS : GLASS2);
      pdf.rect(PAD, y, CW, ROW_H, "F");

      const name = c.nome.length > 36 ? c.nome.slice(0, 36) + "…" : c.nome;
      const statusColor: RGB = c.status === "ativa" ? GREEN : c.status === "pausada" ? YELLOW : MUTED;
      const statusLabel = c.status === "ativa" ? "Ativa" : c.status === "pausada" ? "Pausada" : c.status;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.8);

      tc(pdf, WHITE);       pdf.text(name,                    cols[0].x + 3,            y + 5);
      tc(pdf, statusColor); pdf.text(statusLabel,             cols[1].x + 3,            y + 5);
      tc(pdf, WHITE);       pdf.text(fmtBRL(c.investimento),  cols[2].x + cols[2].w,   y + 5, { align: "right" });
      tc(pdf, GREEN);       pdf.text(fmtNum(c.leads),         cols[3].x + cols[3].w,   y + 5, { align: "right" });
      tc(pdf, ORANGE);      pdf.text(
        c.leads > 0 ? fmtBRL(c.cpl) : "—",
        cols[4].x + cols[4].w, y + 5, { align: "right" }
      );

      y += ROW_H;
    });
  }

  // ── Rodapé ─────────────────────────────────────────────────────────────────
  fc(pdf, SEP);
  pdf.rect(PAD, H - 12, CW, 0.25, "F");
  tc(pdf, DIM);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text("Genesy Dashboard · Relatório confidencial", PAD, H - 7.5);
  pdf.text(
    format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    W - PAD, H - 7.5, { align: "right" }
  );

  // ── Download ───────────────────────────────────────────────────────────────
  const slug = (data.clientName ?? data.portalName)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  pdf.save(`relatorio-${slug}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
