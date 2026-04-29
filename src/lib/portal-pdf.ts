import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PortalKPIs, PortalDailyMetric, PortalCampaignSummary } from "@/types";

// ── Color palette ─────────────────────────────────────────────────────────────

type RGB = [number, number, number];

const C: Record<string, RGB> = {
  bg:     [10,  12,  22],
  card:   [18,  20,  31],
  card2:  [14,  16,  26],
  header: [15,  17,  28],
  border: [30,  32,  48],
  white:  [255, 255, 255],
  muted:  [110, 110, 128],
  dim:    [60,  62,  78],
  green:  [34,  197, 94],
  blue:   [39,  163, 255],
  orange: [249, 115, 22],
  purple: [167, 139, 250],
  cyan:   [6,   182, 212],
  yellow: [245, 158, 11],
  red:    [239, 68,  68],
};

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ── jsPDF helpers ─────────────────────────────────────────────────────────────

function fc(pdf: jsPDF, c: RGB) { pdf.setFillColor(c[0], c[1], c[2]); }
function dc(pdf: jsPDF, c: RGB) { pdf.setDrawColor(c[0], c[1], c[2]); }
function tc(pdf: jsPDF, c: RGB) { pdf.setTextColor(c[0], c[1], c[2]); }

// ── Public interface ──────────────────────────────────────────────────────────

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

// ── Main generator ────────────────────────────────────────────────────────────

export function generatePortalPDF(data: PortalPDFData): void {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W   = 210;
  const PAD = 14;
  const CW  = W - PAD * 2;

  let y = 0;

  // ── Full page background ─────────────────────────────────────────────────
  fc(pdf, C.bg);
  pdf.rect(0, 0, W, 297, "F");

  // ── Header bar ───────────────────────────────────────────────────────────
  fc(pdf, C.header);
  pdf.rect(0, 0, W, 30, "F");
  dc(pdf, C.border);
  pdf.setLineWidth(0.25);
  pdf.line(0, 30, W, 30);

  // Branding
  tc(pdf, C.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("GENESY", PAD, 13);

  tc(pdf, C.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text((data.clientName ?? data.portalName).toUpperCase(), PAD, 22);

  // Period (right-aligned)
  tc(pdf, C.blue);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  const sinceStr = format(new Date(data.since + "T00:00:00"), "dd/MM/yyyy");
  const untilStr = format(new Date(data.until + "T00:00:00"), "dd/MM/yyyy");
  pdf.text(`${data.periodLabel}  ·  ${sinceStr} – ${untilStr}`, W - PAD, 13, { align: "right" });

  tc(pdf, C.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    W - PAD, 22, { align: "right" }
  );

  y = 38;

  // ── Section label helper ─────────────────────────────────────────────────
  function sectionLabel(label: string) {
    tc(pdf, C.muted);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.text(label.toUpperCase(), PAD, y);
    dc(pdf, C.border);
    pdf.setLineWidth(0.2);
    pdf.line(PAD + 44, y - 0.5, PAD + CW, y - 0.5);
    y += 6;
  }

  // ── Metrics grid (2 × 3) ─────────────────────────────────────────────────
  sectionLabel("Métricas do Período");

  const metrics: { label: string; value: string; color: RGB }[] = [
    { label: "INVESTIMENTO", value: fmtBRL(data.kpis.investimento),                        color: C.green  },
    { label: "LEADS",        value: fmtNum(data.kpis.leads),                               color: C.blue   },
    { label: "CPL",          value: data.kpis.leads > 0 ? fmtBRL(data.kpis.cpl) : "—",    color: C.orange },
    { label: "ALCANCE",      value: fmtNum(data.kpis.alcance),                             color: C.purple },
    { label: "CLIQUES",      value: fmtNum(data.kpis.cliques),                             color: C.cyan   },
    { label: "CTR",          value: fmtPct(data.kpis.ctr),                                 color: C.yellow },
  ];

  const CARD_W = (CW - 4) / 3;
  const CARD_H = 20;

  metrics.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx  = PAD + col * (CARD_W + 2);
    const cy  = y + row * (CARD_H + 2);

    // Card background
    fc(pdf, C.card);
    pdf.roundedRect(cx, cy, CARD_W, CARD_H, 1.5, 1.5, "F");

    // Top accent strip
    fc(pdf, m.color);
    pdf.roundedRect(cx, cy, CARD_W, 1.5, 0.5, 0.5, "F");

    // Label
    tc(pdf, C.muted);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.text(m.label, cx + 4, cy + 9);

    // Value
    tc(pdf, C.white);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11.5);
    pdf.text(m.value, cx + 4, cy + 17);
  });

  y += 2 * (CARD_H + 2) + 9;

  // ── Performance chart ────────────────────────────────────────────────────
  const hasDailyData =
    data.daily.length > 1 &&
    data.daily.some(d => d.investimento > 0 || d.leads > 0);

  if (hasDailyData) {
    sectionLabel("Performance no Período");

    const CHART_H = 44;
    const AXIS_W  = 16;
    const CHART_X = PAD + AXIS_W;
    const CHART_W = CW - AXIS_W;

    // Chart card
    fc(pdf, C.card);
    pdf.roundedRect(PAD, y, CW, CHART_H + 12, 2, 2, "F");

    // Horizontal grid lines
    dc(pdf, C.border);
    pdf.setLineWidth(0.15);
    for (let g = 0; g <= 4; g++) {
      const gy = y + 6 + (CHART_H / 4) * g;
      pdf.line(CHART_X, gy, CHART_X + CHART_W, gy);
    }

    const n = data.daily.length;
    const stepX = CHART_W / Math.max(n - 1, 1);

    // Investimento line (green)
    const maxInv = Math.max(...data.daily.map(d => d.investimento), 1);
    const invPts = data.daily.map((d, i) => ({
      x: CHART_X + i * stepX,
      y: y + 6 + CHART_H - (d.investimento / maxInv) * CHART_H,
    }));
    dc(pdf, C.green);
    pdf.setLineWidth(0.9);
    for (let i = 1; i < n; i++)
      pdf.line(invPts[i - 1].x, invPts[i - 1].y, invPts[i].x, invPts[i].y);

    // Leads line (blue)
    const maxLeads = Math.max(...data.daily.map(d => d.leads), 1);
    const ldPts = data.daily.map((d, i) => ({
      x: CHART_X + i * stepX,
      y: y + 6 + CHART_H - (d.leads / maxLeads) * CHART_H,
    }));
    dc(pdf, C.blue);
    pdf.setLineWidth(0.9);
    for (let i = 1; i < n; i++)
      pdf.line(ldPts[i - 1].x, ldPts[i - 1].y, ldPts[i].x, ldPts[i].y);

    // CPL line (orange, dashed)
    const cplDays = data.daily.filter(d => d.cpl > 0);
    if (cplDays.length > 1) {
      const maxCpl = Math.max(...cplDays.map(d => d.cpl), 1);
      dc(pdf, C.orange);
      pdf.setLineWidth(0.7);
      pdf.setLineDashPattern([1.5, 1.2], 0);
      let prevPt: { x: number; y: number } | null = null;
      data.daily.forEach((d, i) => {
        if (d.cpl > 0) {
          const pt = { x: CHART_X + i * stepX, y: y + 6 + CHART_H - (d.cpl / maxCpl) * CHART_H };
          if (prevPt) pdf.line(prevPt.x, prevPt.y, pt.x, pt.y);
          prevPt = pt;
        } else {
          prevPt = null;
        }
      });
      pdf.setLineDashPattern([], 0);
    }

    // X-axis labels
    tc(pdf, C.dim);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.5);
    const step = Math.max(1, Math.floor(n / 8));
    data.daily.forEach((d, i) => {
      if (i % step === 0 || i === n - 1) {
        try {
          const lbl = format(new Date(d.data + "T00:00:00"), "dd/MM", { locale: ptBR });
          pdf.text(lbl, CHART_X + i * stepX, y + CHART_H + 12, { align: "center" });
        } catch { /* skip */ }
      }
    });

    // Legend
    const lx = CHART_X + CHART_W - 76;
    const ly = y + 5;
    pdf.setFontSize(6);
    [[C.green, "Investimento", 0], [C.blue, "Leads", 30], [C.orange, "CPL", 50]] .forEach(([color, lbl, offset]) => {
      fc(pdf, color as RGB);
      pdf.circle(lx + (offset as number), ly, 1, "F");
      tc(pdf, C.muted);
      pdf.text(lbl as string, lx + (offset as number) + 3, ly + 0.8);
    });

    y += CHART_H + 18;
  }

  // ── Funnel ───────────────────────────────────────────────────────────────
  sectionLabel("Funil de Performance");

  const funnelItems = [
    { label: "Alcance", value: data.kpis.alcance, display: fmtNum(data.kpis.alcance), color: C.purple },
    { label: "Cliques", value: data.kpis.cliques, display: fmtNum(data.kpis.cliques), color: C.cyan   },
    { label: "Leads",   value: data.kpis.leads,   display: fmtNum(data.kpis.leads),   color: C.green  },
  ];

  const anchor   = Math.max(data.kpis.alcance, 1);
  const BAR_MAXW = CW - 42;
  const BAR_H    = 8.5;

  funnelItems.forEach(item => {
    const fillW = Math.max(8, (item.value / anchor) * BAR_MAXW);
    const [r, g, b] = item.color;

    // Track
    fc(pdf, C.card);
    pdf.roundedRect(PAD, y, CW, BAR_H, 1.2, 1.2, "F");

    // Fill (muted blend)
    pdf.setFillColor(
      Math.round(r * 0.35 + C.card[0] * 0.65),
      Math.round(g * 0.35 + C.card[1] * 0.65),
      Math.round(b * 0.35 + C.card[2] * 0.65),
    );
    pdf.roundedRect(PAD, y, fillW, BAR_H, 1.2, 1.2, "F");

    // Label
    tc(pdf, item.color);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text(item.label, PAD + 4, y + 5.8);

    // Value
    tc(pdf, C.white);
    pdf.text(item.display, PAD + CW - 3, y + 5.8, { align: "right" });

    y += BAR_H + 3;
  });

  y += 8;

  // ── Campaign table ───────────────────────────────────────────────────────
  const camps = data.campaigns.slice(0, 9);

  if (camps.length > 0) {
    sectionLabel("Campanhas");

    const cols = [
      { label: "Campanha",  x: PAD,              w: CW * 0.37 },
      { label: "Status",    x: PAD + CW * 0.37,  w: CW * 0.13 },
      { label: "Invest.",   x: PAD + CW * 0.50,  w: CW * 0.17 },
      { label: "Leads",     x: PAD + CW * 0.67,  w: CW * 0.10 },
      { label: "CPL",       x: PAD + CW * 0.77,  w: CW * 0.23 },
    ];

    const ROW_H = 7.5;

    // Header row
    fc(pdf, [24, 26, 38] as RGB);
    pdf.rect(PAD, y, CW, ROW_H, "F");

    tc(pdf, C.muted);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    cols.forEach((col, ci) => {
      const right = ci >= 2;
      pdf.text(col.label, right ? col.x + col.w : col.x + 2, y + 4.8, { align: right ? "right" : "left" });
    });
    y += ROW_H;

    // Data rows
    camps.forEach((c, i) => {
      fc(pdf, i % 2 === 0 ? C.card : C.card2);
      pdf.rect(PAD, y, CW, ROW_H, "F");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.8);

      const name = c.nome.length > 36 ? c.nome.slice(0, 36) + "…" : c.nome;
      const statusColor: RGB =
        c.status === "ativa" ? C.green : c.status === "pausada" ? C.yellow : C.muted;
      const statusLabel =
        c.status === "ativa" ? "Ativa" : c.status === "pausada" ? "Pausada" : c.status;

      tc(pdf, C.white);     pdf.text(name,              cols[0].x + 2,              y + 4.8);
      tc(pdf, statusColor); pdf.text(statusLabel,        cols[1].x + 2,              y + 4.8);
      tc(pdf, C.white);     pdf.text(fmtBRL(c.investimento), cols[2].x + cols[2].w, y + 4.8, { align: "right" });
      tc(pdf, C.green);     pdf.text(fmtNum(c.leads),    cols[3].x + cols[3].w,     y + 4.8, { align: "right" });
      tc(pdf, C.orange);    pdf.text(
        c.leads > 0 ? fmtBRL(c.cpl) : "—",
        cols[4].x + cols[4].w, y + 4.8, { align: "right" }
      );

      y += ROW_H;
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  fc(pdf, C.border);
  pdf.rect(PAD, 287, CW, 0.25, "F");

  tc(pdf, C.dim);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text("Genesy Dashboard · Relatório confidencial", PAD, 292);
  pdf.text(
    format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    W - PAD, 292, { align: "right" }
  );

  // ── Save ─────────────────────────────────────────────────────────────────
  const slug = (data.clientName ?? data.portalName)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const dateStr = format(new Date(), "yyyy-MM-dd");
  pdf.save(`relatorio-${slug}-${dateStr}.pdf`);
}
