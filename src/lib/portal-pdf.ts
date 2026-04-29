// ─────────────────────────────────────────────────────────────────────────────
// portal-pdf.ts — Relatório Genesy · template oficial (2 páginas)
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PortalKPIs, PortalDailyMetric, PortalCampaignSummary } from "@/types";

type RGB = [number, number, number];

// ── Paleta ────────────────────────────────────────────────────────────────────
const BLACK:  RGB = [4,    4,    6  ];
const BG:     RGB = [9,    9,    13 ];
const CARD:   RGB = [20,   20,   26 ];
const CARD2:  RGB = [14,   14,   19 ];
const HDR:    RGB = [12,   12,   17 ];
const THDR:   RGB = [26,   26,   34 ];
const SEP:    RGB = [40,   40,   52 ];

const WHITE:  RGB = [255,  255,  255];
const TEXT:   RGB = [215,  215,  225];
const MUTED:  RGB = [105,  105,  118];
const DIM:    RGB = [36,   36,   46 ];

const BLUE:   RGB = [56,   168,  255];
const GREEN:  RGB = [52,   199,  108];
const AMBER:  RGB = [245,  158,  11 ];
const PURPLE: RGB = [161,  128,  242];
const CYAN:   RGB = [34,   183,  205];

// ── Formatadores ──────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fc = (p: jsPDF, c: RGB) => p.setFillColor(c[0], c[1], c[2]);
const dc = (p: jsPDF, c: RGB) => p.setDrawColor(c[0], c[1], c[2]);
const tc = (p: jsPDF, c: RGB) => p.setTextColor(c[0], c[1], c[2]);
const lw = (p: jsPDF, w: number) => p.setLineWidth(w);

function over(color: RGB, opacity: number): RGB {
  return [
    Math.round(color[0] * opacity + BG[0] * (1 - opacity)),
    Math.round(color[1] * opacity + BG[1] * (1 - opacity)),
    Math.round(color[2] * opacity + BG[2] * (1 - opacity)),
  ];
}

function areaFill(pdf: jsPDF, pts: { x: number; y: number }[], bottomY: number, color: RGB, op: number) {
  if (pts.length < 2) return;
  const [r, g, b] = over(color, op);
  pdf.setFillColor(r, g, b);
  const sx = pts[0].x, sy = pts[0].y;
  const segs: number[][] = pts.slice(1).map((pt, i) => [pt.x - pts[i].x, pt.y - pts[i].y]);
  segs.push([0, bottomY - pts[pts.length - 1].y]);
  segs.push([sx - pts[pts.length - 1].x, 0]);
  pdf.lines(segs, sx, sy, [1, 1], "F", true);
}

function polyline(pdf: jsPDF, pts: { x: number; y: number }[], color: RGB, width: number, dash?: [number, number]) {
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
  const W = 210, H = 297, PAD = 14, CW = W - PAD * 2;

  const clientDisplay = data.clientName ?? data.portalName;
  const sinceStr = format(new Date(data.since + "T00:00:00"), "dd/MM/yyyy");
  const untilStr = format(new Date(data.until + "T00:00:00"), "dd/MM/yyyy");

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — CAPA
  // ══════════════════════════════════════════════════════════════════════════
  fc(pdf, BLACK);
  pdf.rect(0, 0, W, H, "F");

  // Planos geométricos em perspectiva (sugerem as caixas 3D do template)
  const planes: { x: number; y: number; w: number; h: number; r: number; fill: RGB }[] = [
    { x: 0,       y: H * 0.30, w: W,       h: H * 0.75, r: 0,  fill: [10, 10, 14] },
    { x: W * 0.08,y: H * 0.36, w: W * 0.84,h: H * 0.66, r: 8,  fill: [14, 14, 19] },
    { x: W * 0.18,y: H * 0.43, w: W * 0.64,h: H * 0.57, r: 10, fill: [18, 18, 24] },
    { x: W * 0.28,y: H * 0.50, w: W * 0.44,h: H * 0.50, r: 12, fill: [22, 22, 29] },
  ];
  planes.forEach(p => {
    fc(pdf, p.fill);
    if (p.r > 0) pdf.roundedRect(p.x, p.y, p.w, p.h, p.r, p.r, "F");
    else pdf.rect(p.x, p.y, p.w, p.h, "F");
  });

  // Bordas sutis nos planos centrais
  dc(pdf, [32, 32, 42] as RGB);
  lw(pdf, 0.3);
  pdf.roundedRect(W * 0.08, H * 0.36, W * 0.84, H * 0.66, 8, 8, "S");

  // "@lancastermatos" — handle da agência, topo
  tc(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("@lancastermatos", W / 2, 24, { align: "center" });

  // Traços decorativos laterais ao handle
  dc(pdf, DIM);
  lw(pdf, 0.3);
  const hW = pdf.getTextWidth("@lancastermatos");
  pdf.line(W / 2 - hW / 2 - 10, 21.5, W / 2 - hW / 2 - 2, 21.5);
  pdf.line(W / 2 + hW / 2 + 2,  21.5, W / 2 + hW / 2 + 10, 21.5);

  // Ícone G (container escuro + letra)
  const iconY = H * 0.40;
  fc(pdf, [24, 24, 32] as RGB);
  pdf.roundedRect(W / 2 - 36, iconY, 22, 22, 4, 4, "F");
  dc(pdf, [48, 48, 62] as RGB);
  lw(pdf, 0.4);
  pdf.roundedRect(W / 2 - 36, iconY, 22, 22, 4, 4, "S");

  tc(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("G", W / 2 - 36 + 11, iconY + 15.5, { align: "center" });

  // Wordmark "genesy"
  tc(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(34);
  pdf.text("genesy", W / 2 - 10, iconY + 17);

  // Tagline
  tc(pdf, [140, 140, 154] as RGB);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text("PERFORMANCE IMOBILIÁRIA", W / 2, iconY + 32, { align: "center" });

  // Linha decorativa abaixo da tagline
  dc(pdf, DIM);
  lw(pdf, 0.3);
  pdf.line(W / 2 - 28, iconY + 36, W / 2 + 28, iconY + 36);

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 2 — DADOS
  // ══════════════════════════════════════════════════════════════════════════
  pdf.addPage();

  fc(pdf, BG);
  pdf.rect(0, 0, W, H, "F");

  let y = 0;

  // ── Header ────────────────────────────────────────────────────────────────
  fc(pdf, HDR);
  pdf.rect(0, 0, W, 30, "F");

  // Ícone G pequeno
  fc(pdf, [28, 28, 38] as RGB);
  pdf.roundedRect(PAD, 9, 11, 11, 2, 2, "F");
  tc(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("G", PAD + 5.5, 17.2, { align: "center" });

  // Wordmark
  tc(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.text("genesy", PAD + 14, 16.5);

  // Handle (direita)
  tc(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("@lancastermatos", W - PAD, 16.5, { align: "right" });

  // Borda inferior
  dc(pdf, SEP);
  lw(pdf, 0.3);
  pdf.line(0, 30, W, 30);

  y = 40;

  // ── Bloco de título ───────────────────────────────────────────────────────
  tc(pdf, WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("RELATÓRIO DE TRÁFEGO PAGO", PAD, y);
  y += 7;

  tc(pdf, TEXT);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(`${clientDisplay}  |  ${sinceStr} – ${untilStr}`, PAD, y);
  y += 6;

  dc(pdf, SEP);
  lw(pdf, 0.4);
  pdf.line(PAD, y, PAD + CW, y);
  y += 10;

  // ── Helper: rótulo de seção ───────────────────────────────────────────────
  function sectionLabel(label: string) {
    tc(pdf, MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.2);
    pdf.text(label.toUpperCase(), PAD, y);
    const lw2 = pdf.getTextWidth(label.toUpperCase());
    dc(pdf, SEP);
    lw(pdf, 0.3);
    pdf.line(PAD + lw2 + 4, y - 1, PAD + CW, y - 1);
    y += 7;
  }

  // ── Cards KPI (3 × 2) ─────────────────────────────────────────────────────
  sectionLabel("Performance do Período");

  const kpis: { label: string; value: string; color: RGB }[] = [
    { label: "INVESTIMENTO",   value: fmtBRL(data.kpis.investimento),                     color: BLUE   },
    { label: "LEADS",          value: fmtNum(data.kpis.leads),                            color: GREEN  },
    { label: "CUSTO POR LEAD", value: data.kpis.leads > 0 ? fmtBRL(data.kpis.cpl) : "—", color: AMBER  },
    { label: "ALCANCE",        value: fmtNum(data.kpis.alcance),                          color: PURPLE },
    { label: "CLIQUES",        value: fmtNum(data.kpis.cliques),                          color: CYAN   },
    { label: "CTR",            value: fmtPct(data.kpis.ctr),                              color: AMBER  },
  ];

  const CARD_W = (CW - 6) / 3;
  const CARD_H = 24;
  const CR     = 3;

  kpis.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx  = PAD + col * (CARD_W + 3);
    const cy  = y + row * (CARD_H + 3);

    fc(pdf, CARD);
    pdf.roundedRect(cx, cy, CARD_W, CARD_H, CR, CR, "F");

    // Rótulo
    tc(pdf, MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(5.8);
    pdf.text(m.label, cx + 5, cy + 9);

    // Linha colorida abaixo do rótulo (fiel ao template)
    const accW = Math.min(pdf.getTextWidth(m.label) + 1, CARD_W - 10);
    dc(pdf, m.color);
    lw(pdf, 1.1);
    pdf.line(cx + 5, cy + 11, cx + 5 + accW, cy + 11);

    // Valor
    tc(pdf, WHITE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(m.value, cx + 5, cy + 21.5);
  });

  y += 2 * (CARD_H + 3) + 10;

  // ── Funil de Performance (gráfico de linha) ───────────────────────────────
  sectionLabel("Funil de Performance");

  const CHART_CARD_H = 60;

  fc(pdf, CARD);
  pdf.roundedRect(PAD, y, CW, CHART_CARD_H, 3, 3, "F");

  const hasDailyData =
    data.daily.length > 1 &&
    data.daily.some(d => d.investimento > 0 || d.leads > 0);

  if (hasDailyData) {
    const CH    = 38;
    const AXISW = 10;
    const CX    = PAD + AXISW + 4;
    const CTRW  = CW - AXISW - 12;
    const CT    = y + 12;
    const CBOT  = CT + CH;
    const n     = data.daily.length;
    const stepX = CTRW / Math.max(n - 1, 1);

    // Grid
    dc(pdf, DIM);
    lw(pdf, 0.15);
    for (let g = 0; g <= 3; g++) {
      const gy = CT + (CH / 3) * g;
      pdf.line(CX, gy, CX + CTRW, gy);
    }

    // Investimento
    const maxInv = Math.max(...data.daily.map(d => d.investimento), 1);
    const invPts = data.daily.map((d, i) => ({
      x: CX + i * stepX,
      y: CT + CH - (d.investimento / maxInv) * CH,
    }));
    areaFill(pdf, invPts, CBOT, BLUE, 0.09);
    polyline(pdf, invPts, BLUE, 0.85);

    // Leads
    const maxLeads = Math.max(...data.daily.map(d => d.leads), 1);
    const ldPts = data.daily.map((d, i) => ({
      x: CX + i * stepX,
      y: CT + CH - (d.leads / maxLeads) * CH,
    }));
    areaFill(pdf, ldPts, CBOT, GREEN, 0.08);
    polyline(pdf, ldPts, GREEN, 0.85);

    // CPL tracejado
    const cplOk = data.daily.filter(d => d.cpl > 0);
    if (cplOk.length > 1) {
      const maxCpl = Math.max(...cplOk.map(d => d.cpl), 1);
      let seg: { x: number; y: number }[] = [];
      data.daily.forEach((d, i) => {
        if (d.cpl > 0) {
          seg.push({ x: CX + i * stepX, y: CT + CH - (d.cpl / maxCpl) * CH });
        } else if (seg.length > 0) {
          polyline(pdf, seg, AMBER, 0.7, [1.8, 1.4]);
          seg = [];
        }
      });
      if (seg.length > 0) polyline(pdf, seg, AMBER, 0.7, [1.8, 1.4]);
    }

    // Eixo X
    tc(pdf, MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.2);
    const xStep = Math.max(1, Math.floor(n / 7));
    data.daily.forEach((d, i) => {
      if (i % xStep === 0 || i === n - 1) {
        try {
          pdf.text(
            format(new Date(d.data + "T00:00:00"), "dd/MM", { locale: ptBR }),
            CX + i * stepX, CBOT + 6,
            { align: "center" }
          );
        } catch { /* skip */ }
      }
    });

    // Legenda (traços — mais profissional)
    const legendItems: [RGB, string][] = [[BLUE, "Investimento"], [GREEN, "Leads"], [AMBER, "CPL"]];
    let lx = PAD + CW - 78;
    const ly = y + 8;
    legendItems.forEach(([color, label]) => {
      dc(pdf, color);
      lw(pdf, 1.1);
      pdf.line(lx, ly, lx + 7, ly);
      tc(pdf, MUTED);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(5.8);
      pdf.text(label, lx + 9.5, ly + 1.2);
      lx += 27;
    });
  } else {
    tc(pdf, MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text("Sem dados no período selecionado", PAD + CW / 2, y + CHART_CARD_H / 2 + 2, { align: "center" });
  }

  y += CHART_CARD_H + 9;

  // ── Campanhas ─────────────────────────────────────────────────────────────
  sectionLabel("Campanhas");

  const camps = data.campaigns.slice(0, 7);

  if (camps.length > 0) {
    const cols = [
      { label: "Campanha",  x: PAD,             w: CW * 0.38, right: false },
      { label: "Status",    x: PAD + CW * 0.38, w: CW * 0.13, right: false },
      { label: "Invest.",   x: PAD + CW * 0.51, w: CW * 0.17, right: true  },
      { label: "Leads",     x: PAD + CW * 0.68, w: CW * 0.10, right: true  },
      { label: "CPL",       x: PAD + CW * 0.78, w: CW * 0.22, right: true  },
    ];
    const ROW_H = 7.5;

    // Cabeçalho
    fc(pdf, THDR);
    pdf.roundedRect(PAD, y, CW, ROW_H, 2, 2, "F");
    // Zera cantos inferiores do header (ficam retos)
    pdf.rect(PAD, y + ROW_H / 2, CW, ROW_H / 2, "F");

    tc(pdf, MUTED);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.2);
    cols.forEach(c => {
      pdf.text(c.label, c.right ? c.x + c.w : c.x + 3.5, y + 5, { align: c.right ? "right" : "left" });
    });
    y += ROW_H;

    // Linhas de dados
    camps.forEach((camp, i) => {
      fc(pdf, i % 2 === 0 ? CARD : CARD2);
      // Arredonda cantos inferiores na última linha
      if (i === camps.length - 1) {
        pdf.roundedRect(PAD, y, CW, ROW_H, 2, 2, "F");
        pdf.rect(PAD, y, CW, ROW_H / 2, "F"); // zera cantos superiores
      } else {
        pdf.rect(PAD, y, CW, ROW_H, "F");
      }

      const name = camp.nome.length > 38 ? camp.nome.slice(0, 38) + "…" : camp.nome;
      const sColor: RGB = camp.status === "ativa" ? GREEN : camp.status === "pausada" ? AMBER : MUTED;
      const sLabel = camp.status === "ativa" ? "Ativa" : camp.status === "pausada" ? "Pausada" : camp.status;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.8);

      tc(pdf, TEXT);    pdf.text(name,                      cols[0].x + 3.5,       y + 5);
      tc(pdf, sColor);  pdf.text(sLabel,                    cols[1].x + 3.5,       y + 5);
      tc(pdf, TEXT);    pdf.text(fmtBRL(camp.investimento),  cols[2].x + cols[2].w, y + 5, { align: "right" });
      tc(pdf, GREEN);   pdf.text(fmtNum(camp.leads),         cols[3].x + cols[3].w, y + 5, { align: "right" });
      tc(pdf, AMBER);   pdf.text(
        camp.leads > 0 ? fmtBRL(camp.cpl) : "—",
        cols[4].x + cols[4].w, y + 5, { align: "right" }
      );

      y += ROW_H;
    });
  } else {
    tc(pdf, MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text("Nenhuma campanha no período selecionado", PAD, y + 5);
    y += 12;
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────
  tc(pdf, MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text("Gerado por Genesy Performance Imobiliária", W / 2, H - 8, { align: "center" });

  // ── Salvar ────────────────────────────────────────────────────────────────
  const slug = (data.clientName ?? data.portalName)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  pdf.save(`relatorio-${slug}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
