import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { COMMERCIAL_PRODUCT_LABELS, type CommercialAnalysis } from "@/types/commercial-analysis";
import { formatCommercialAnalysisTitle } from "@/lib/clientes/commercial-analysis-format";

type RGB = [number, number, number];
const BLACK: RGB = [16, 18, 20];
const MUTED: RGB = [93, 101, 108];
const BORDER: RGB = [218, 222, 226];
const SURFACE: RGB = [246, 247, 248];
const ACCENT: RGB = [124, 135, 142];
const GREEN: RGB = [28, 137, 88];
const AMBER: RGB = [190, 124, 28];
const RED: RGB = [193, 64, 75];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    for (let offset = 0; offset < chunk.length; offset += 1) binary += String.fromCharCode(chunk[offset]);
  }
  return btoa(binary);
}

async function loadBrandFont(pdf: jsPDF, url: string, fileName: string, style: "normal" | "bold") {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Não foi possível carregar a fonte da marca");
  pdf.addFileToVFS(fileName, arrayBufferToBase64(await response.arrayBuffer()));
  pdf.addFont(fileName, "TTFirsNeue", style);
}

async function loadLogoDataUrl() {
  const response = await fetch("/brand/genesy-all-preto.svg");
  if (!response.ok) throw new Error("Não foi possível carregar a logomarca");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1370;
    canvas.height = 299;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a logomarca");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function saveCommercialAnalysisPdf(analysis: CommercialAnalysis, clientName: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const [logo] = await Promise.all([
    loadLogoDataUrl(),
    loadBrandFont(pdf, "/brand/tt-firs-neue-light.ttf", "tt-firs-light.ttf", "normal"),
    loadBrandFont(pdf, "/brand/tt-firs-neue-medium.ttf", "tt-firs-medium.ttf", "bold"),
  ]);
  pdf.setFont("TTFirsNeue", "normal");

  const pageWidth = 210;
  const margin = 15;
  const width = pageWidth - margin * 2;
  const footerY = 286;
  let y = 15;
  const setText = (color: RGB, size: number, style: "normal" | "bold" = "normal") => {
    pdf.setTextColor(...color);
    pdf.setFont("TTFirsNeue", style);
    pdf.setFontSize(size);
  };
  const newPage = () => { pdf.addPage(); y = 16; };
  const ensure = (height: number) => { if (y + height > footerY) newPage(); };
  const lines = (text: string, maxWidth = width) => pdf.splitTextToSize(text || "Não informado.", maxWidth) as string[];
  const paragraph = (text: string, color: RGB = MUTED, size = 8, maxWidth = width) => {
    const wrapped = lines(text, maxWidth);
    ensure(wrapped.length * 4 + 3);
    setText(color, size);
    pdf.text(wrapped, margin, y);
    y += wrapped.length * 4 + 3;
  };
  const section = (title: string) => {
    ensure(13);
    y += 2;
    setText(BLACK, 11, "bold");
    pdf.text(title, margin, y);
    y += 4;
    pdf.setDrawColor(...BORDER);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  pdf.addImage(logo, "PNG", margin, y, 43, 9.4);
  setText(MUTED, 7);
  pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth - margin, y + 5, { align: "right" });
  y += 18;
  setText(BLACK, 20, "bold");
  pdf.text(formatCommercialAnalysisTitle(analysis.meeting_date), margin, y);
  y += 7;
  setText(BLACK, 11, "bold");
  pdf.text(clientName, margin, y);
  y += 5;
  setText(MUTED, 8);
  pdf.text(`Reunião de ${format(new Date(`${analysis.meeting_date}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}  |  Período ${format(new Date(`${analysis.period_start}T12:00:00`), "dd/MM/yyyy")} a ${format(new Date(`${analysis.period_end}T12:00:00`), "dd/MM/yyyy")}`, margin, y);
  y += 9;

  pdf.setFillColor(...SURFACE);
  pdf.setDrawColor(...BORDER);
  pdf.roundedRect(margin, y, width, 25, 3, 3, "FD");
  setText(BLACK, 15, "bold");
  pdf.text(`${analysis.analysis_snapshot.score}/100`, margin + 5, y + 9);
  setText(MUTED, 7, "bold");
  pdf.text("SAÚDE COMERCIAL", margin + 5, y + 16);
  setText(BLACK, 8);
  pdf.text(lines(analysis.analysis_snapshot.executiveSummary, width - 45).slice(0, 3), margin + 39, y + 8);
  y += 32;

  const m = analysis.analysis_snapshot.metrics;
  const metrics = [
    ["LEADS", String(analysis.leads_received)], ["SEM RESPOSTA", String(analysis.leads_no_response)],
    ["TAXA DE RESPOSTA", `${m.responseRate}%`], ["COMPARECIMENTO", `${m.attendanceRate}%`],
    ["VENDAS", String(analysis.sales_closed)], ["CONVERSÃO", `${m.closingRate}%`],
    ["RECEITA", money.format(analysis.revenue)], ["TICKET MÉDIO", money.format(m.averageTicket)],
  ];
  const gap = 3;
  const cardWidth = (width - gap * 3) / 4;
  metrics.forEach(([label, value], index) => {
    const x = margin + (index % 4) * (cardWidth + gap);
    const cardY = y + Math.floor(index / 4) * 20;
    pdf.setFillColor(...SURFACE);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(x, cardY, cardWidth, 17, 2, 2, "FD");
    setText(MUTED, 5.7, "bold");
    pdf.text(label, x + 3, cardY + 5);
    setText(BLACK, value.length > 15 ? 8.5 : 11, "bold");
    pdf.text(value, x + 3, cardY + 12.5);
  });
  y += 45;

  section("Leitura dos indicadores");
  analysis.analysis_snapshot.insights.forEach((item) => {
    const color = item.status === "good" ? GREEN : item.status === "attention" ? AMBER : item.status === "critical" ? RED : ACCENT;
    const content = [item.signal, `Onde analisar: ${item.diagnosis}`, `Próxima ação: ${item.action}`];
    const totalLines = content.reduce((count, value) => count + lines(value, width - 12).length, 0);
    const height = 13 + totalLines * 3.6;
    ensure(height + 4);
    pdf.setFillColor(...SURFACE);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(margin, y, width, height, 2, 2, "FD");
    pdf.setFillColor(...color);
    pdf.roundedRect(margin, y, 2.2, height, 1, 1, "F");
    setText(color, 8.5, "bold");
    pdf.text(item.title, margin + 6, y + 6);
    let textY = y + 11;
    content.forEach((value, index) => {
      const wrapped = lines(value, width - 12);
      setText(index === 2 ? BLACK : MUTED, 7.1, index === 2 ? "bold" : "normal");
      pdf.text(wrapped, margin + 6, textY);
      textY += wrapped.length * 3.6 + 1;
    });
    y += height + 4;
  });

  section("Contexto e decisões da reunião");
  const notes = [
    ["Perfil e empreendimento", `${COMMERCIAL_PRODUCT_LABELS[analysis.product_type]}${analysis.development_name ? ` · ${analysis.development_name}` : ""}\n${analysis.lead_profile_notes ?? "Sem observações."}`],
    ["O que funcionou", analysis.wins], ["Pontos de bloqueio", analysis.blockers],
    ["Decisões tomadas", analysis.decisions], ["Próximas ações", analysis.next_actions],
    ["Motivos de perda", analysis.loss_reasons],
  ] as const;
  notes.forEach(([title, text]) => {
    const wrapped = lines(text || "Não informado.", width - 10);
    ensure(12 + wrapped.length * 3.8);
    setText(BLACK, 8, "bold");
    pdf.text(title, margin, y);
    y += 4.5;
    paragraph(text || "Não informado.", MUTED, 7.3, width);
  });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...BORDER);
    pdf.line(margin, 289, pageWidth - margin, 289);
    setText(MUTED, 6);
    pdf.text("GENESY · Inteligência comercial", margin, 293);
    pdf.text(`${page}/${pages}`, pageWidth - margin, 293, { align: "right" });
  }

  const safeClient = clientName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase();
  pdf.save(`diagnostico-comercial-${safeClient}-${analysis.meeting_date}.pdf`);
}
