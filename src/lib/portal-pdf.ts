// ─────────────────────────────────────────────────────────────────────────────
// portal-pdf.ts — PDF executivo clean B2B · Genesy
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PortalKPIs, PortalDailyMetric, PortalCampaignSummary } from "@/types";

type RGB = [number, number, number];

// ── Paleta ────────────────────────────────────────────────────────────────────
const BG:      RGB = [10,  12,  18];  // página — carvão profundo
const SURFACE: RGB = [18,  21,  30];  // superfície dos cards
const SURF2:   RGB = [13,  15,  23];  // linha alternada (tabela)
const BORDER:  RGB = [38,  41,  56];  // borda discreta
const HDR_BG:  RGB = [13,  15,  23];  // fundo do header
const THDR:    RGB = [22,  26,  38];  // cabeçalho da tabela

const WHITE:   RGB = [255, 255, 255];
const TEXT:    RGB = [210, 213, 228]; // texto principal
const MUTED:   RGB = [96,  99, 116];  // rótulos / secundário
const DIM:     RGB = [38,  41,  56];  // grid / divisórias

// Cores das métricas — sólidas, refinadas
const BLUE:    RGB = [58,  168, 255]; // investimento
const GREEN:   RGB = [52,  199, 108]; // leads
const ORANGE:  RGB = [249, 115, 22];  // CPL
const PURPLE:  RGB = [161, 128, 242]; // alcance
const CYAN:    RGB = [34,  183, 205]; // cliques
const AMBER:   RGB = [245, 158, 11];  // CTR

// ── Formatadores ──────────────────────────────────────────────────────────────
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

// Composita uma cor sobre o fundo — sem efeitos, apenas mistura flat
function over(color: RGB, opacity: number): RGB {
  return [
    Math.round(color[0] * opacity + BG[0] * (1 - opacity)),
    Math.round(color[1] * opacity + BG[1] * (1 - opacity)),
    Math.round(color[2] * opacity + BG[2] * (1 - opacity)),
  ];
}

// Área preenchida sob uma polilinha — flat, sem glow
function areaFill(
  pdf: jsPDF,
  pts: { x: number; y: number }[],
  bottomY: number,
  color: RGB,
  opacity: number,
) {
  if (pts.length < 2) return;
  const [r, g, b] = over(color, opacity);
  pdf.setFillColor(r, g, b);
  const sx = pts[0].x;
  const sy = pts[0].y;
  const segs: number[][] = pts.slice(1).map((pt, i) => [pt.x - pts[i].x, pt.y - pts[i].y]);
  segs.push([0, bottomY - pts[pts.length - 1].y]);
  segs.push([sx - pts[pts.length - 1].x, 0]);
  pdf.lines(segs, sx, sy, [1, 1], "F", true);
}

// Linha limpa — sem nenhum efeito extra
function line(
  pdf: jsPDF,
  pts: { x: number; y: number }[],
  color: RGB,
  width: number,
  dash?: [number, number],
) {
  if (pts.length < 2) return;
  dc(pdf, color);
  lw(pdf, width);
  if (dash) pdf.setLineDashPattern([dash[0], dash[1]], 0);
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

  // ── Fundo ─────────────────────────────────────────────────────────────────
  fc(pdf, BG);
  pdf.rect(0, 0, W, H, "F");

  // ── Header ────────────────────────────────────────────────────────────────
  fc(pdf, HDR_BG);
  pdf.rect(0, 0, W, 28, "F");

  // Borda inferior do header — linha fina
  dc(pdf, BORDER);
  lw(pdf, 0.3);
  pdf.line(0, 28, W, 28);

  // Logomarca GENESY
  tc(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("GENESY", PAD, 12);

  // Ponto azul após logo (detalhe de marca)
  const logoW = pdf.getTextWidth("GENESY");
  fc(pdf, BLUE);
  pdf.circle(PAD + logoW + 2, 10.5, 0.9, "F");

  // Separador + nome do cliente
  tc(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("|", PAD + logoW + 6, 12);

  tc(pdf, TEXT);
  pdf.setFontSize(8.5);
  pdf.text(data.clientName ?? data.portalName, PAD + logoW + 11, 12);

  // "Relatório de Performance" — subtítulo discreto abaixo do logo
  tc(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text("Relatório de Performance", PAD, 20.5);

  // Período (lado direito)
  const sinceStr = format(new Date(data.since + "T00:00:00"), "dd/MM/yyyy");
  const untilStr = format(new Date(data.until + "T00:00:00"), "dd/MM/yyyy");

  tc(pdf, TEXT);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(`${sinceStr} – ${untilStr}`, W - PAD, 11.5, { align: "right" });

  tc(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text(data.periodLabel, W - PAD, 19, { align: "right" });

  y = 36;

  // ── Helper: rótulo de seção ───────────────────────────────────────────────
  function sectionLabel(label: string) {
    tc(pdf, MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.2);
    pdf.text(label.toUpperCase(), PAD, y);
    const lblW = pdf.getTextWidth(label.toUpperCase());
    dc(pdf, DIM);
    lw(pdf, 0.2);
    pdf.line(PAD + lblW + 4, y - 0.8, PAD + CW, y - 0.8);
    y += 6;
  }

  // ── Cards KPI (2 × 3) ─────────────────────────────────────────────────────
  sectionLabel("Métricas do Período");

  const kpiCards: { label: string; value: string; color: RGB }[] = [
    { label: "INVESTIMENTO", value: fmtBRL(data.kpis.investimento),                     color: BLUE   },
    { label: "LEADS",        value: fmtNum(data.kpis.leads),                            color: GREEN  },
    { label: "CPL",          value: data.kpis.leads > 0 ? fmtBRL(data.kpis.cpl) : "—", color: ORANGE },
    { label: "ALCANCE",      value: fmtNum(data.kpis.alcance),                          color: PURPLE },
    { label: "CLIQUES",      value: fmtNum(data.kpis.cliques),                          color: CYAN   },
    { label: "CTR",          value: fmtPct(data.kpis.ctr),                              color: AMBER  },
  ];

  const CARD_W = (CW - 6) / 3;
  const CARD_H = 22;
  const RR     = 2;

  kpiCards.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx  = PAD + col * (CARD_W + 3);
    const cy  = y + row * (CARD_H + 3);

    // Fundo do card
    fc(pdf, SURFACE);
    pdf.roundedRect(cx, cy, CARD_W, CARD_H, RR, RR, "F");

    // Borda fina
    dc(pdf, BORDER);
    lw(pdf, 0.25);
    pdf.roundedRect(cx, cy, CARD_W, CARD_H, RR, RR, "S");

    // Linha superior colorida — fina e limpa
    dc(pdf, m.color);
    lw(pdf, 1.6);
    pdf.line(cx + RR + 0.5, cy, cx + CARD_W - RR - 0.5, cy);

    // Rótulo
    tc(pdf, MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(5.8);
    pdf.text(m.label, cx + 4.5, cy + 10);

    // Valor
    tc(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(m.value, cx + 4.5, cy + 19);
  });

  y += 2 * (CARD_H + 3) + 10;

  // ── Gráfico de performance ────────────────────────────────────────────────
  const hasDailyData =
    data.daily.length > 1 &&
    data.daily.some(d => d.investimento > 0 || d.leads > 0);

  if (hasDailyData) {
    sectionLabel("Performance no Período");

    const CH     = 44;
    const AXISW  = 12;
    const CX     = PAD + AXISW;
    const CTRW   = CW - AXISW - 4;
    const CARD_T = y;
    const CBOT   = CARD_T + 10 + CH;

    // Card do gráfico
    fc(pdf, SURFACE);
    pdf.roundedRect(PAD, CARD_T, CW, CH + 18, RR, RR, "F");
    dc(pdf, BORDER);
    lw(pdf, 0.25);
    pdf.roundedRect(PAD, CARD_T, CW, CH + 18, RR, RR, "S");

    // Grid horizontal — muito discreto
    dc(pdf, DIM);
    lw(pdf, 0.15);
    for (let g = 0; g <= 4; g++) {
      const gy = CARD_T + 10 + (CH / 4) * g;
      pdf.line(CX, gy, CX + CTRW, gy);
    }

    const n     = data.daily.length;
    const stepX = CTRW / Math.max(n - 1, 1);

    // Investimento (azul) — área sutil + linha
    const maxInv = Math.max(...data.daily.map(d => d.investimento), 1);
    const invPts = data.daily.map((d, i) => ({
      x: CX + i * stepX,
      y: CARD_T + 10 + CH - (d.investimento / maxInv) * CH,
    }));
    areaFill(pdf, invPts, CBOT, BLUE, 0.09);
    line(pdf, invPts, BLUE, 0.9);

    // Leads (verde) — área sutil + linha
    const maxLeads = Math.max(...data.daily.map(d => d.leads), 1);
    const ldPts = data.daily.map((d, i) => ({
      x: CX + i * stepX,
      y: CARD_T + 10 + CH - (d.leads / maxLeads) * CH,
    }));
    areaFill(pdf, ldPts, CBOT, GREEN, 0.08);
    line(pdf, ldPts, GREEN, 0.9);

    // CPL (laranja tracejado) — sem área, apenas linha elegante
    const cplFiltered = data.daily.filter(d => d.cpl > 0);
    if (cplFiltered.length > 1) {
      const maxCpl = Math.max(...cplFiltered.map(d => d.cpl), 1);
      let seg: { x: number; y: number }[] = [];
      data.daily.forEach((d, i) => {
        if (d.cpl > 0) {
          seg.push({ x: CX + i * stepX, y: CARD_T + 10 + CH - (d.cpl / maxCpl) * CH });
        } else if (seg.length > 0) {
          line(pdf, seg, ORANGE, 0.75, [1.8, 1.4]);
          seg = [];
        }
      });
      if (seg.length > 0) line(pdf, seg, ORANGE, 0.75, [1.8, 1.4]);
    }

    // Rótulos eixo X
    tc(pdf, MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.5);
    const xStep = Math.max(1, Math.floor(n / 8));
    data.daily.forEach((d, i) => {
      if (i % xStep === 0 || i === n - 1) {
        try {
          const lbl = format(new Date(d.data + "T00:00:00"), "dd/MM", { locale: ptBR });
          pdf.text(lbl, CX + i * stepX, CBOT + 8, { align: "center" });
        } catch { /* skip */ }
      }
    });

    // Legenda com traços (profissional)
    const legendItems: [RGB, string][] = [
      [BLUE,   "Investimento"],
      [GREEN,  "Leads"],
      [ORANGE, "CPL"],
    ];
    let lx = CX + CTRW - 74;
    const ly = CARD_T + 7.5;
    legendItems.forEach(([color, label]) => {
      dc(pdf, color);
      lw(pdf, 1.2);
      pdf.line(lx, ly, lx + 8, ly);
      tc(pdf, MUTED);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      pdf.text(label, lx + 10.5, ly + 1.2);
      lx += 28;
    });

    y = CARD_T + CH + 18 + 9;
  }

  // ── Funil ─────────────────────────────────────────────────────────────────
  sectionLabel("Funil de Performance");

  const funnelItems: { label: string; value: number; display: string; color: RGB }[] = [
    { label: "Alcance", value: data.kpis.alcance, display: fmtNum(data.kpis.alcance), color: PURPLE },
    { label: "Cliques", value: data.kpis.cliques, display: fmtNum(data.kpis.cliques), color: CYAN   },
    { label: "Leads",   value: data.kpis.leads,   display: fmtNum(data.kpis.leads),   color: GREEN  },
  ];

  const anchor  = Math.max(data.kpis.alcance, 1);
  const MAXBARW = CW - 48;
  const BARH    = 9;

  funnelItems.forEach(item => {
    const fillW = Math.max(16, (item.value / anchor) * MAXBARW);

    // Track (fundo do funil)
    fc(pdf, SURFACE);
    pdf.roundedRect(PAD, y, CW, BARH, 1.5, 1.5, "F");
    dc(pdf, BORDER);
    lw(pdf, 0.2);
    pdf.roundedRect(PAD, y, CW, BARH, 1.5, 1.5, "S");

    // Barra preenchida — cor flat composta, discreta
    fc(pdf, over(item.color, 0.20));
    pdf.roundedRect(PAD, y, fillW, BARH, 1.5, 1.5, "F");

    // Linha vertical colorida à esquerda (acento de identidade)
    dc(pdf, item.color);
    lw(pdf, 2);
    pdf.line(PAD + 1, y + 1.8, PAD + 1, y + BARH - 1.8);

    // Rótulo
    tc(pdf, TEXT);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text(item.label, PAD + 5.5, y + 6.2);

    // Valor (direita)
    tc(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text(item.display, PAD + CW - 5, y + 6.2, { align: "right" });

    y += BARH + 3;
  });

  y += 8;

  // ── Tabela de campanhas ───────────────────────────────────────────────────
  const camps = data.campaigns.slice(0, 9);

  if (camps.length > 0) {
    sectionLabel("Campanhas");

    const cols = [
      { label: "Campanha", x: PAD,             w: CW * 0.38, right: false },
      { label: "Status",   x: PAD + CW * 0.38, w: CW * 0.13, right: false },
      { label: "Invest.",  x: PAD + CW * 0.51, w: CW * 0.17, right: true  },
      { label: "Leads",    x: PAD + CW * 0.68, w: CW * 0.10, right: true  },
      { label: "CPL",      x: PAD + CW * 0.78, w: CW * 0.22, right: true  },
    ];
    const ROW_H = 7.5;

    // Cabeçalho da tabela
    fc(pdf, THDR);
    pdf.roundedRect(PAD, y, CW, ROW_H, 1.5, 1.5, "F");

    tc(pdf, MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.2);
    cols.forEach(col => {
      pdf.text(col.label, col.right ? col.x + col.w : col.x + 3.5, y + 5, {
        align: col.right ? "right" : "left",
      });
    });
    y += ROW_H;

    // Linha separadora abaixo do cabeçalho
    dc(pdf, BORDER);
    lw(pdf, 0.2);
    pdf.line(PAD, y, PAD + CW, y);
    y += 0.5;

    // Linhas de dados
    camps.forEach((c, i) => {
      fc(pdf, i % 2 === 0 ? SURFACE : SURF2);
      pdf.rect(PAD, y, CW, ROW_H, "F");

      const name = c.nome.length > 38 ? c.nome.slice(0, 38) + "…" : c.nome;

      const statusColor: RGB =
        c.status === "ativa"   ? GREEN  :
        c.status === "pausada" ? AMBER  : MUTED;
      const statusLabel =
        c.status === "ativa"   ? "Ativa"   :
        c.status === "pausada" ? "Pausada" : c.status;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.8);

      tc(pdf, TEXT);       pdf.text(name,                        cols[0].x + 3.5,          y + 5);
      tc(pdf, statusColor);pdf.text(statusLabel,                 cols[1].x + 3.5,          y + 5);
      tc(pdf, TEXT);       pdf.text(fmtBRL(c.investimento),      cols[2].x + cols[2].w,   y + 5, { align: "right" });
      tc(pdf, GREEN);      pdf.text(fmtNum(c.leads),             cols[3].x + cols[3].w,   y + 5, { align: "right" });
      tc(pdf, ORANGE);     pdf.text(
        c.leads > 0 ? fmtBRL(c.cpl) : "—",
        cols[4].x + cols[4].w, y + 5, { align: "right" }
      );

      y += ROW_H;
    });

    // Borda inferior da tabela
    dc(pdf, BORDER);
    lw(pdf, 0.2);
    pdf.line(PAD, y, PAD + CW, y);
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────
  dc(pdf, DIM);
  lw(pdf, 0.2);
  pdf.line(PAD, H - 12, PAD + CW, H - 12);

  tc(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6);
  pdf.text("Genesy · Relatório confidencial", PAD, H - 7.5);
  pdf.text(
    format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    W - PAD, H - 7.5, { align: "right" }
  );

  // ── Salvar ────────────────────────────────────────────────────────────────
  const slug = (data.clientName ?? data.portalName)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  pdf.save(`relatorio-${slug}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
