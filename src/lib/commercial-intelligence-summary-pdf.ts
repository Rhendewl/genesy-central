import { jsPDF } from "jspdf";
import type { FormStep } from "@/types";
import type { CommercialCollection, CommercialResponse } from "@/types/commercial-intelligence";

type RGB = [number, number, number];
type SummaryInput = {
  clientName: string;
  collection: CommercialCollection;
  responses: CommercialResponse[];
};
type SummaryAssets = { logo: string; lightFont: string; mediumFont: string };

const PAGE_WIDTH = 108;
const PAGE_HEIGHT = 192;
const MARGIN = 8;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM_Y = 176;
const FOOTER_Y = 185;
const INK: RGB = [17, 20, 23];
const MUTED: RGB = [94, 103, 111];
const LINE: RGB = [224, 228, 232];
const SURFACE: RGB = [246, 248, 249];
const BLUE: RGB = [39, 163, 255];
const BLUE_SURFACE: RGB = [239, 248, 255];
const BLUE_LINE: RGB = [190, 225, 248];
const GREEN: RGB = [24, 143, 91];
const AMBER: RGB = [190, 124, 28];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function cleanText(value: unknown) {
  return String(value ?? "").replace(/[\u2010-\u2015]/g, "-").trim();
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    for (let offset = 0; offset < chunk.length; offset += 1) binary += String.fromCharCode(chunk[offset]);
  }
  return btoa(binary);
}

async function loadLogoDataUrl() {
  const response = await fetch("/brand/genesy-all-preto.svg");
  if (!response.ok) throw new Error("Não foi possível carregar a logomarca");
  const url = URL.createObjectURL(await response.blob());
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

async function loadDefaultAssets(): Promise<SummaryAssets> {
  const [logo, lightResponse, mediumResponse] = await Promise.all([
    loadLogoDataUrl(),
    fetch("/brand/tt-firs-neue-light.ttf"),
    fetch("/brand/tt-firs-neue-medium.ttf"),
  ]);
  if (!lightResponse.ok || !mediumResponse.ok) throw new Error("Não foi possível carregar a fonte da marca");
  return {
    logo,
    lightFont: arrayBufferToBase64(await lightResponse.arrayBuffer()),
    mediumFont: arrayBufferToBase64(await mediumResponse.arrayBuffer()),
  };
}

function formatAnswer(value: unknown, question?: FormStep): string {
  if (value === null || value === undefined || value === "") return "Não respondido";
  if (Array.isArray(value)) return value.map((item) => formatAnswer(item)).join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map((item) => formatAnswer(item)).join(" · ");
  return question?.choices?.find((item) => item.value === value)?.label ?? String(value);
}

export function calculateCommercialSummaryMetrics(collection: CommercialCollection, responses: CommercialResponse[]) {
  const scored = responses.filter((response) => typeof response.score === "number");
  const leads = collection.developments.reduce((sum, development) => sum + development.leads, 0);
  const spend = collection.developments.reduce((sum, development) => sum + development.spend, 0);
  return {
    responses: responses.length,
    developments: collection.developments.length,
    averageScore: scored.length ? scored.reduce((sum, response) => sum + Number(response.score), 0) / scored.length : null,
    leads,
    spend,
    cpl: leads ? spend / leads : null,
    responseRate: collection.expected_responses ? responses.length / collection.expected_responses * 100 : null,
  };
}

export function commercialSummaryFilename(clientName: string, periodEnd: string) {
  const safeName = clientName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase() || "cliente";
  return `resumo-analise-comercial-${safeName}-${periodEnd}.pdf`;
}

export function createCommercialIntelligenceSummaryPdf({ clientName, collection, responses }: SummaryInput, assets: SummaryAssets) {
  const pdf = new jsPDF({ unit: "mm", format: [PAGE_WIDTH, PAGE_HEIGHT], orientation: "portrait" });
  pdf.addFileToVFS("tt-firs-light.ttf", assets.lightFont);
  pdf.addFont("tt-firs-light.ttf", "TTFirsNeue", "normal");
  pdf.addFileToVFS("tt-firs-medium.ttf", assets.mediumFont);
  pdf.addFont("tt-firs-medium.ttf", "TTFirsNeue", "bold");
  const metrics = calculateCommercialSummaryMetrics(collection, responses);
  const questions = ((collection.meta_snapshot as { questions?: FormStep[] })?.questions ?? []);
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  let y = 8;

  const setText = (color: RGB, size: number, style: "normal" | "bold" = "normal") => {
    pdf.setTextColor(...color);
    pdf.setFont("TTFirsNeue", style);
    pdf.setFontSize(size);
  };
  const lines = (text: unknown, width = CONTENT_WIDTH) => pdf.splitTextToSize(cleanText(text) || "Não informado.", width) as string[];
  const drawHeader = () => {
    pdf.addImage(assets.logo, "PNG", MARGIN, 7, 27, 5.9);
    setText(MUTED, 5.5, "bold");
    pdf.text("ANÁLISE COMERCIAL", PAGE_WIDTH - MARGIN, 10.5, { align: "right" });
    pdf.setDrawColor(...LINE);
    pdf.line(MARGIN, 16, PAGE_WIDTH - MARGIN, 16);
    y = 22;
  };
  const addPage = () => { pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], "portrait"); y = 8; };
  const ensure = (height: number) => { if (y + height > CONTENT_BOTTOM_Y) addPage(); };
  const paragraph = (text: unknown, color: RGB = MUTED, size = 6.7, indent = 0) => {
    const wrapped = lines(text, CONTENT_WIDTH - indent);
    const height = wrapped.length * 3.3 + 2;
    ensure(height);
    setText(color, size);
    pdf.text(wrapped, MARGIN + indent, y);
    y += height;
  };
  const section = (title: string, eyebrow?: string) => {
    ensure(16);
    y += 2;
    if (eyebrow) { setText(BLUE, 5.2, "bold"); pdf.text(cleanText(eyebrow).toUpperCase(), MARGIN, y); y += 4; }
    setText(INK, 11, "bold");
    pdf.text(cleanText(title), MARGIN, y);
    y += 4;
    pdf.setDrawColor(...LINE);
    pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 6;
  };
  const bulletList = (items: string[], color: RGB) => {
    if (!items.length) { paragraph("Nenhum item registrado."); return; }
    items.forEach((item) => {
      const wrapped = lines(item, CONTENT_WIDTH - 7);
      ensure(wrapped.length * 3.3 + 4);
      pdf.setFillColor(...color);
      pdf.circle(MARGIN + 1.4, y - 1, .8, "F");
      setText(INK, 6.6);
      pdf.text(wrapped, MARGIN + 5, y);
      y += wrapped.length * 3.3 + 3;
    });
  };

  drawHeader();
  setText(BLUE, 5.4, "bold");
  pdf.text("RESUMO EXECUTIVO", MARGIN, y);
  y += 6;
  setText(INK, 17, "bold");
  const titleLines = lines(clientName, CONTENT_WIDTH).slice(0, 2);
  pdf.text(titleLines, MARGIN, y);
  y += titleLines.length * 7 + 1;
  setText(MUTED, 7);
  pdf.text(lines(collection.name, CONTENT_WIDTH), MARGIN, y);
  y += 8;
  setText(MUTED, 5.8);
  pdf.text(`${new Date(`${collection.period_start}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${collection.period_end}T12:00:00`).toLocaleDateString("pt-BR")}  |  Gerado em ${new Date().toLocaleDateString("pt-BR")}`, MARGIN, y);
  y += 8;

  const cards = [
    ["PERCEPÇÃO", metrics.averageScore === null ? "-" : `${metrics.averageScore.toFixed(1)}/10`],
    ["RESPOSTAS", String(metrics.responses)],
    ["ADESÃO", metrics.responseRate === null ? "-" : `${Math.round(metrics.responseRate)}%`],
    ["EMPREENDIMENTOS", String(metrics.developments)],
    ["LEADS", metrics.leads.toLocaleString("pt-BR")],
    ["INVESTIMENTO", money.format(metrics.spend)],
    ["CPL MÉDIO", metrics.cpl === null ? "-" : money.format(metrics.cpl)],
    ["OBJEÇÕES", String(responses.filter((response) => response.objection).length)],
  ];
  const cardWidth = (CONTENT_WIDTH - 3) / 2;
  cards.forEach(([label, value], index) => {
    const x = MARGIN + (index % 2) * (cardWidth + 3);
    const cardY = y + Math.floor(index / 2) * 17;
    pdf.setFillColor(...SURFACE); pdf.setDrawColor(...LINE); pdf.roundedRect(x, cardY, cardWidth, 14, 2, 2, "FD");
    setText(MUTED, 4.7, "bold"); pdf.text(label, x + 3, cardY + 4.5);
    setText(index === 0 ? BLUE : INK, value.length > 14 ? 7 : 9.5, "bold"); pdf.text(value, x + 3, cardY + 10.8);
  });
  y += 73;

  const developments = collection.developments.map((development) => ({
    ...development,
    responses: responses.filter((response) => response.development_name === development.name),
  }));
  developments.forEach((development, developmentIndex) => {
    const scored = development.responses.filter((response) => typeof response.score === "number");
    const averageScore = scored.length ? scored.reduce((sum, response) => sum + Number(response.score), 0) / scored.length : null;
    ensure(65);
    section(development.name, `Empreendimento ${developmentIndex + 1} de ${developments.length}`);
    const summary = [
      `${development.responses.length} resposta${development.responses.length === 1 ? "" : "s"}`,
      averageScore === null ? "Sem nota" : `Nota ${averageScore.toFixed(1)}/10`,
      `${development.leads} leads`,
      money.format(development.spend),
      development.leads ? `CPL ${money.format(development.spend / development.leads)}` : "CPL não disponível",
    ];
    setText(MUTED, 5.8, "bold");
    pdf.text(lines(summary.join("  |  "), CONTENT_WIDTH), MARGIN, y);
    y += 7;

    if (!development.responses.length) paragraph("Nenhum corretor respondeu sobre este empreendimento.");
    development.responses.forEach((response) => {
      const entries = Object.entries(response.answers).map(([id, value]) => ({
        question: questionMap.get(id)?.title ?? id.replaceAll("_", " "),
        answer: formatAnswer(value, questionMap.get(id)),
      }));
      const headerHeight = response.objection ? 19 : 14;
      ensure(headerHeight + 25);
      pdf.setFillColor(...SURFACE); pdf.setDrawColor(...LINE); pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, headerHeight, 2, 2, "FD");
      setText(INK, 7.5, "bold"); pdf.text(cleanText(response.broker_name || "Corretor"), MARGIN + 4, y + 5.5);
      setText(BLUE, 6.4, "bold"); pdf.text(response.score === null ? "Sem nota" : `${response.score}/10`, PAGE_WIDTH - MARGIN - 4, y + 5.5, { align: "right" });
      setText(MUTED, 5.3); pdf.text(`Respondido em ${new Date(response.completed_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, MARGIN + 4, y + 10.5);
      if (response.objection) { setText(AMBER, 5.5, "bold"); pdf.text(lines(`Objeção: ${response.objection}`, CONTENT_WIDTH - 8).slice(0, 2), MARGIN + 4, y + 15); }
      y += headerHeight + 4;
      entries.forEach((entry, index) => {
        const questionLines = lines(`${index + 1}. ${entry.question}`, CONTENT_WIDTH - 3);
        const answerLines = lines(entry.answer, CONTENT_WIDTH - 3);
        ensure(questionLines.length * 3 + answerLines.length * 3.3 + 6);
        setText(MUTED, 5.7, "bold"); pdf.text(questionLines, MARGIN + 2, y);
        y += questionLines.length * 3 + 1;
        setText(INK, 6.6); pdf.text(answerLines, MARGIN + 2, y);
        y += answerLines.length * 3.3 + 4;
      });
      y += 2;
    });
  });

  const diagnosis = collection.ai_diagnosis;
  const diagnosisSummaryLines = diagnosis ? lines(diagnosis.executiveSummary, CONTENT_WIDTH - 8) : [];
  const diagnosisSummaryHeight = diagnosisSummaryLines.length * 3.5 + 8;
  ensure(22 + (diagnosis ? diagnosisSummaryHeight : 12));
  section("Análise comercial gerada por IA", "Diagnóstico final");
  if (!diagnosis) {
    paragraph("O diagnóstico de IA ainda não foi gerado para esta coleta. Gere o diagnóstico na aba IA e exporte novamente para incluí-lo.", AMBER, 7);
  } else {
    pdf.setFillColor(...BLUE_SURFACE); pdf.setDrawColor(...BLUE_LINE);
    pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, diagnosisSummaryHeight, 2, 2, "FD");
    setText(INK, 6.8); pdf.text(diagnosisSummaryLines, MARGIN + 4, y + 5.5); y += diagnosisSummaryHeight + 5;
    setText(GREEN, 7.3, "bold"); pdf.text("Destaques", MARGIN, y); y += 5; bulletList(diagnosis.highlights, GREEN);
    setText(AMBER, 7.3, "bold"); pdf.text("Pontos de atenção", MARGIN, y); y += 5; bulletList(diagnosis.risks, AMBER);
    setText(BLUE, 7.3, "bold"); pdf.text("Recomendações", MARGIN, y); y += 5; bulletList(diagnosis.recommendations, BLUE);
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...LINE); pdf.line(MARGIN, FOOTER_Y, PAGE_WIDTH - MARGIN, FOOTER_Y);
    setText(MUTED, 4.8); pdf.text("GENESY · Inteligência comercial", MARGIN, 189);
    pdf.text(`${page}/${pages}`, PAGE_WIDTH - MARGIN, 189, { align: "right" });
  }
  return pdf;
}

export async function saveCommercialIntelligenceSummaryPdf(input: SummaryInput) {
  const assets = await loadDefaultAssets();
  createCommercialIntelligenceSummaryPdf(input, assets).save(commercialSummaryFilename(input.clientName, input.collection.period_end));
}
