import jsPDF from "jspdf";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CrmActivity, CrmActivityType, CrmReportResponse } from "@/types/crm-reports";

type RGB = [number, number, number];

export interface CrmReportPdfOptions {
  report: CrmReportResponse;
  from: Date;
  to: Date;
  includeNotes: boolean;
  pipelineLabel?: string;
  assigneeLabel?: string;
  generatedAt?: Date;
}

export const CRM_EVENT_LABELS: Record<CrmActivityType, string> = {
  lead_created: "Lead criado",
  lead_pipeline_copied: "Lead copiado para pipeline",
  lead_deleted: "Lead excluído",
  stage_changed: "Etapa alterada",
  deal_won: "Venda ganha",
  deal_lost: "Negócio perdido",
  assignee_changed: "Responsável alterado",
  note_added: "Nota adicionada",
  note_updated: "Nota atualizada",
  note_deleted: "Nota removida",
  stage_note: "Nota da movimentação",
  tags_changed: "Tags alteradas",
  deal_value_changed: "Valor alterado",
};

const INK: RGB = [25, 32, 42];
const MUTED: RGB = [93, 105, 120];
const BORDER: RGB = [218, 224, 231];
const SURFACE: RGB = [246, 248, 251];
const BLUE: RGB = [46, 112, 177];
const GREEN: RGB = [30, 137, 82];
const WHITE: RGB = [255, 255, 255];

const brl = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(value);

const number = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const percentage = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const cleanLabel = (value: unknown) => String(value ?? "").replaceAll("_", " ").replace(/\s+/g, " ").trim();

function detailsFor(item: CrmActivity, includeNotes: boolean) {
  if (item.note_content) return includeNotes ? item.note_content : "Conteúdo da nota ocultado";
  if (item.from_stage_name || item.to_stage_name) {
    return `${cleanLabel(item.from_stage_name || "Sem etapa")} > ${cleanLabel(item.to_stage_name || "Sem etapa")}`;
  }
  if (item.event_type === "assignee_changed") {
    return `${cleanLabel(item.metadata.from || "Sem responsável")} > ${cleanLabel(item.metadata.to || "Sem responsável")}`;
  }
  if (item.event_type === "deal_value_changed") {
    return `${brl(Number(item.metadata.before ?? 0))} > ${brl(Number(item.metadata.after ?? 0))}`;
  }
  return "-";
}

function periodLabel(from: Date, to: Date) {
  if (isSameDay(from, to)) return format(from, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  return `${format(from, "dd/MM/yyyy")} a ${format(to, "dd/MM/yyyy")}`;
}

export function createCrmReportPdf(options: CrmReportPdfOptions) {
  const { report, from, to, includeNotes } = options;
  const generatedAt = options.generatedAt ?? new Date();
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const footerLimit = 284;
  let y = 16;

  const setText = (color: RGB, size: number, style: "normal" | "bold" = "normal") => {
    pdf.setTextColor(...color);
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
  };

  const newPage = () => {
    pdf.addPage();
    y = 16;
  };

  const ensureSpace = (height: number) => {
    if (y + height > footerLimit) newPage();
  };

  const sectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(subtitle ? 18 : 13);
    setText(INK, 12, "bold");
    pdf.text(title, margin, y);
    y += 5;
    if (subtitle) {
      setText(MUTED, 7.2);
      pdf.text(subtitle, margin, y);
      y += 4;
    }
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.25);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  // Header
  setText(BLUE, 7.5, "bold");
  pdf.text("LANCASTER CRM", margin, y);
  setText(MUTED, 7.2);
  pdf.text(`Gerado em ${format(generatedAt, "dd/MM/yyyy 'às' HH:mm")}`, pageWidth - margin, y, { align: "right" });
  y += 9;
  setText(INK, 20, "bold");
  pdf.text("Relatório de atividades do CRM", margin, y);
  y += 7;
  setText(MUTED, 9);
  pdf.text(periodLabel(from, to), margin, y);
  y += 5;
  const filters = [options.pipelineLabel, options.assigneeLabel].filter(Boolean).join("  |  ");
  if (filters) {
    setText(MUTED, 7.5);
    pdf.text(`Filtros: ${filters}`, margin, y);
    y += 5;
  }
  y += 3;

  sectionTitle("Resumo executivo", "Visão consolidada dos resultados no período selecionado");

  const metrics = [
    ["LEADS RECEBIDOS", number(report.summary.leadsCreated)],
    ["LEADS TRABALHADOS", number(report.summary.leadsWorked)],
    ["MOVIMENTAÇÕES", number(report.summary.stageMovements)],
    ["VENDAS", number(report.summary.dealsWon)],
    ["VALOR VENDIDO", brl(report.summary.wonValue)],
    ["CONVERSÃO", percentage(report.summary.conversionRate)],
  ] as const;
  const cardGap = 3;
  const cardWidth = (contentWidth - cardGap * 2) / 3;
  const cardHeight = 20;
  metrics.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = margin + column * (cardWidth + cardGap);
    const cardY = y + row * (cardHeight + cardGap);
    pdf.setFillColor(...SURFACE);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "FD");
    setText(MUTED, 6.2, "bold");
    pdf.text(label, x + 4, cardY + 6);
    setText(label === "VALOR VENDIDO" || label === "VENDAS" ? GREEN : INK, 12, "bold");
    pdf.text(value, x + 4, cardY + 15);
  });
  y += cardHeight * 2 + cardGap + 9;

  pdf.setFillColor(239, 246, 253);
  pdf.setDrawColor(194, 217, 239);
  pdf.roundedRect(margin, y, contentWidth, 23, 2, 2, "FD");
  setText(BLUE, 7, "bold");
  pdf.text("LEITURA RÁPIDA", margin + 4, y + 6);
  setText(INK, 8);
  const highlight = `${number(report.summary.leadsWorked)} leads trabalhados em ${number(report.summary.totalActivities)} ações; `
    + `${number(report.summary.stageMovements)} movimentações e ${number(report.summary.dealsWon)} vendas registradas.`;
  pdf.text(pdf.splitTextToSize(highlight, contentWidth - 8), margin + 4, y + 12);
  y += 30;

  if (report.byStage.length > 0) {
    sectionTitle("Movimentações por etapa", "Distribuição das atividades entre as etapas do funil");
    const stages = report.byStage.slice(0, 6);
    const maxStageActivities = Math.max(1, ...stages.map(item => item.activities));
    stages.forEach((item) => {
      ensureSpace(8);
      setText(INK, 7.2);
      pdf.text(pdf.splitTextToSize(cleanLabel(item.label), 57)[0], margin, y + 4.5);
      pdf.setFillColor(...SURFACE);
      pdf.roundedRect(margin + 61, y + 1, 105, 4, 1, 1, "F");
      pdf.setFillColor(...BLUE);
      pdf.roundedRect(margin + 61, y + 1, 105 * item.activities / maxStageActivities, 4, 1, 1, "F");
      setText(INK, 7.2, "bold");
      pdf.text(number(item.activities), pageWidth - margin, y + 4.5, { align: "right" });
      y += 7;
    });
    y += 5;
  }

  sectionTitle("Desempenho por responsável", "Conversão calculada sobre os leads trabalhados por cada responsável");
  const assigneeColumns = [
    { label: "Responsável", x: margin, width: 67, align: "left" as const },
    { label: "Ações", x: margin + 67, width: 23, align: "right" as const },
    { label: "Leads", x: margin + 90, width: 23, align: "right" as const },
    { label: "Vendas", x: margin + 113, width: 23, align: "right" as const },
    { label: "Conversão", x: margin + 136, width: 23, align: "right" as const },
    { label: "Valor", x: margin + 159, width: 23, align: "right" as const },
  ];
  const drawAssigneeHeader = () => {
    pdf.setFillColor(...SURFACE);
    pdf.rect(margin, y, contentWidth, 8, "F");
    setText(MUTED, 6.4, "bold");
    assigneeColumns.forEach(column => pdf.text(column.label, column.align === "right" ? column.x + column.width - 2 : column.x + 2, y + 5.2, { align: column.align }));
    y += 8;
  };
  drawAssigneeHeader();
  if (report.byAssignee.length === 0) {
    setText(MUTED, 7.5);
    pdf.text("Nenhuma atividade encontrada.", margin + 2, y + 6);
    y += 10;
  } else {
    report.byAssignee.slice(0, 40).forEach((item) => {
      if (y + 8 > footerLimit) {
        newPage();
        sectionTitle("Desempenho por responsável - continuação");
        drawAssigneeHeader();
      }
      const values = [
        item.label, number(item.activities), number(item.leads), number(item.wins),
        percentage(item.leads ? (item.wins / item.leads) * 100 : 0), brl(item.value),
      ];
      setText(INK, 7.2);
      assigneeColumns.forEach((column, index) => {
        const raw = values[index];
        const clipped = index === 0 ? pdf.splitTextToSize(raw, column.width - 5)[0] : raw;
        pdf.text(clipped, column.align === "right" ? column.x + column.width - 2 : column.x + 2, y + 5.3, { align: column.align });
      });
      pdf.setDrawColor(...BORDER);
      pdf.line(margin, y + 8, pageWidth - margin, y + 8);
      y += 8;
    });
  }
  y += 8;

  sectionTitle("Linha do tempo", `${number(report.activities.length)} atividades registradas; eventos mais recentes primeiro`);
  const timelineColumns = [
    { label: "Data", x: margin, width: 24 },
    { label: "Colaborador", x: margin + 24, width: 35 },
    { label: "Lead", x: margin + 59, width: 39 },
    { label: "Atividade", x: margin + 98, width: 31 },
    { label: "Detalhes", x: margin + 129, width: 53 },
  ];
  const drawTimelineHeader = () => {
    pdf.setFillColor(...BLUE);
    pdf.rect(margin, y, contentWidth, 9, "F");
    setText(WHITE, 6.4, "bold");
    timelineColumns.forEach(column => pdf.text(column.label, column.x + 2, y + 5.8));
    y += 9;
  };
  drawTimelineHeader();

  if (report.activities.length === 0) {
    setText(MUTED, 7.5);
    pdf.text("Nenhuma atividade encontrada no período.", margin + 2, y + 7);
    y += 12;
  } else {
    report.activities.forEach((item, index) => {
      setText(INK, 6.6);
      const cells = [
        format(new Date(item.occurred_at), "dd/MM HH:mm"),
        item.actor_name || "Sistema",
        cleanLabel(item.lead_name || "Lead sem nome"),
        CRM_EVENT_LABELS[item.event_type],
        detailsFor(item, includeNotes),
      ];
      const wrapped = cells.map((cell, cellIndex) => pdf.splitTextToSize(cell, timelineColumns[cellIndex].width - 4).slice(0, 4));
      const rowHeight = Math.max(9, Math.max(...wrapped.map(lines => lines.length)) * 3.2 + 3);
      if (y + rowHeight > footerLimit) {
        newPage();
        sectionTitle("Linha do tempo - continuação");
        drawTimelineHeader();
      }
      if (!item.actor_user_id || index % 2 === 1) {
        pdf.setFillColor(...(!item.actor_user_id ? [248, 245, 255] as RGB : SURFACE));
        pdf.rect(margin, y, contentWidth, rowHeight, "F");
      }
      setText(INK, 6.6);
      wrapped.forEach((lines, cellIndex) => pdf.text(lines, timelineColumns[cellIndex].x + 2, y + 4.4));
      pdf.setDrawColor(...BORDER);
      pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
      y += rowHeight;
    });
  }

  const definitions = "Leads trabalhados: leads com alguma atividade no período. Movimentações: alterações de etapa, ganhos e perdas. Ações: todos os eventos registrados no CRM.";
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...BORDER);
    pdf.line(margin, 288, pageWidth - margin, 288);
    setText(MUTED, 5.8);
    pdf.text(definitions, margin, 292, { maxWidth: contentWidth - 18 });
    pdf.text(`${page}/${pages}`, pageWidth - margin, 292, { align: "right" });
  }

  return pdf;
}

export function saveCrmReportPdf(options: CrmReportPdfOptions, filename: string) {
  createCrmReportPdf(options).save(filename);
}
