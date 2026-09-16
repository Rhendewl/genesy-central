import { jsPDF } from "jspdf";
import { trafficReportFilename } from "@/lib/traffic-report";
import type { TrafficReportData } from "@/types/traffic-report";

type RGB = [number, number, number];
export type TrafficReportPdfAssets = { logoDark: string; logoLight: string; lightFont: string; mediumFont: string };
export type TrafficReportFileHandle = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
};

const W = 108;
const H = 192;
const PAD = 8;
const CW = W - PAD * 2;
const BLACK: RGB = [8, 9, 10];
const WHITE: RGB = [255, 255, 255];
const GRAY_DARK: RGB = [123, 135, 142];
const GRAY_LIGHT: RGB = [175, 184, 192];
const SURFACE: RGB = [241, 243, 244];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const clean = (value: unknown) => String(value ?? "").replace(/[\u2010-\u2015]/g, "-").trim();
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    for (let offset = 0; offset < chunk.length; offset += 1) binary += String.fromCharCode(chunk[offset]);
  }
  return btoa(binary);
}

async function logoDataUrl(color: string) {
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
    context.globalCompositeOperation = "source-in";
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadAssets(): Promise<TrafficReportPdfAssets> {
  const [logoDark, logoLight, light, medium] = await Promise.all([
    logoDataUrl("#111417"),
    logoDataUrl("#ffffff"),
    fetch("/brand/tt-firs-neue-light.ttf"),
    fetch("/brand/tt-firs-neue-medium.ttf"),
  ]);
  if (!light.ok || !medium.ok) throw new Error("Não foi possível carregar a fonte da marca");
  return { logoDark, logoLight, lightFont: bufferToBase64(await light.arrayBuffer()), mediumFont: bufferToBase64(await medium.arrayBuffer()) };
}

export function createTrafficReportPdf(data: TrafficReportData, assets: TrafficReportPdfAssets) {
  const pdf = new jsPDF({ unit: "mm", format: [W, H], orientation: "portrait" });
  pdf.addFileToVFS("tt-firs-light.ttf", assets.lightFont);
  pdf.addFont("tt-firs-light.ttf", "TTFirsNeue", "normal");
  pdf.addFileToVFS("tt-firs-medium.ttf", assets.mediumFont);
  pdf.addFont("tt-firs-medium.ttf", "TTFirsNeue", "bold");
  let y = 8;

  const text = (color: RGB, size: number, style: "normal" | "bold" = "normal") => {
    pdf.setTextColor(...color); pdf.setFont("TTFirsNeue", style); pdf.setFontSize(size);
  };
  const wrap = (value: unknown, width = CW) => pdf.splitTextToSize(clean(value), width) as string[];
  const addPage = () => { pdf.addPage([W, H], "portrait"); y = 8; };
  const header = (eyebrow: string, title: string) => {
    pdf.addImage(assets.logoDark, "PNG", PAD, 7, 29, 6.3);
    text(BLACK, 5.7, "bold"); pdf.text(clean(eyebrow).toUpperCase(), W - PAD, 11.2, { align: "right" });
    pdf.setDrawColor(...GRAY_LIGHT); pdf.setLineWidth(0.7); pdf.line(PAD, 16.5, W - PAD, 16.5);
    text(BLACK, 14.5, "bold"); pdf.text(wrap(title, CW), PAD, 26);
    y = 34;
  };
  const section = (title: string, subtitle?: string) => {
    text(BLACK, 10.5, "bold"); pdf.text(clean(title), PAD, y);
    if (subtitle) { text(BLACK, 6); pdf.text(clean(subtitle), PAD, y + 4.5); y += 5.5; }
    y += 6;
  };

  // Capa
  pdf.setFillColor(...BLACK); pdf.rect(0, 0, W, H, "F");
  pdf.addImage(assets.logoLight, "PNG", PAD, 10, 29, 6.3);
  text(WHITE, 7.4, "bold"); pdf.text("RELATÓRIO EXECUTIVO", PAD, 58);
  text(WHITE, 27, "bold"); pdf.text(wrap("Tráfego Pago", 88), PAD, 75);
  text(WHITE, 15, "bold"); pdf.text(wrap(data.clientName, 90).slice(0, 2), PAD, 95);
  text(WHITE, 9.5); pdf.text(`${date(data.since)} a ${date(data.until)}`, PAD, 119);
  if (data.accountName) { text(WHITE, 7.5); pdf.text(wrap(data.accountName, 88), PAD, 129); }
  pdf.setDrawColor(...GRAY_LIGHT); pdf.setLineWidth(1.1); pdf.line(PAD, 143, 38, 143);
  text(WHITE, 7.2); pdf.text("Performance de mídia, campanhas e resultados", PAD, 153);
  text(WHITE, 6.4); pdf.text(`Gerado em ${new Date(data.generatedAt).toLocaleDateString("pt-BR")}`, PAD, H - 10);

  // Resumo em quadrantes
  addPage(); header("Performance do período", "Resumo executivo");
  const main = [
    { label: "VALOR INVESTIDO", value: money.format(data.metrics.spend), fill: BLACK, color: WHITE },
    { label: "LEADS GERADOS", value: number.format(data.metrics.leads), fill: GRAY_DARK, color: WHITE },
    { label: "CUSTO POR LEAD", value: data.metrics.leads ? money.format(data.metrics.cpl) : "-", fill: GRAY_LIGHT, color: BLACK },
    { label: "CTR (TAXA DE CLIQUES)", value: `${data.metrics.ctr.toFixed(2)}%`, fill: BLACK, color: WHITE },
  ];
  const boxW = (CW - 3) / 2; const boxH = 31;
  main.forEach((metric, index) => {
    const x = PAD + (index % 2) * (boxW + 3); const boxY = y + Math.floor(index / 2) * (boxH + 3);
    pdf.setFillColor(...metric.fill); pdf.roundedRect(x, boxY, boxW, boxH, 2, 2, "F");
    text(metric.color, 6.2, "bold"); pdf.text(metric.label, x + 4, boxY + 8);
    text(metric.color, metric.value.length > 14 ? 9.5 : 13, "bold"); pdf.text(metric.value, x + 4, boxY + 22);
  });
  y += 72;
  section("Métricas complementares", "Indicadores de entrega e eficiência");
  const secondary = [
    ["IMPRESSÕES", number.format(data.metrics.impressions)], ["ALCANCE", number.format(data.metrics.reach)],
    ["CLIQUES", number.format(data.metrics.clicks)], ["CONVERSÕES", number.format(data.metrics.conversions)],
    ["CPC MÉDIO", data.metrics.clicks ? money.format(data.metrics.cpc) : "-"], ["CPM MÉDIO", data.metrics.impressions ? money.format(data.metrics.cpm) : "-"],
  ];
  const smallW = (CW - 4) / 3;
  secondary.forEach(([label, value], index) => {
    const x = PAD + (index % 3) * (smallW + 2); const boxY = y + Math.floor(index / 3) * 20;
    pdf.setFillColor(...SURFACE); pdf.setDrawColor(...GRAY_LIGHT); pdf.roundedRect(x, boxY, smallW, 18, 1.5, 1.5, "FD");
    text(BLACK, 5.8, "bold"); pdf.text(label, x + 3, boxY + 5.5);
    text(BLACK, value.length > 12 ? 7 : 8.6, "bold"); pdf.text(value, x + 3, boxY + 13);
  });

  // Campanhas
  addPage(); header("Ranking de performance", "Melhores campanhas");
  if (!data.campaigns.length) { text(BLACK, 7); pdf.text("Nenhuma campanha com dados no período.", PAD, y); }
  data.campaigns.slice(0, 6).forEach((campaign, index) => {
    const h = 24;
    pdf.setFillColor(...SURFACE); pdf.setDrawColor(...GRAY_LIGHT);
    pdf.roundedRect(PAD, y, CW, h, 2, 2, "FD");
    pdf.setFillColor(...GRAY_DARK); pdf.roundedRect(PAD + 2.5, y + 3, 8, 8, 1.4, 1.4, "F");
    text(WHITE, 6.6, "bold"); pdf.text(String(index + 1), PAD + 6.5, y + 7, { align: "center", baseline: "middle" });
    text(BLACK, 7.2, "bold"); pdf.text(wrap(campaign.name, 61).slice(0, 2), PAD + 13, y + 7);
    pdf.setFillColor(...GRAY_LIGHT); pdf.roundedRect(W - PAD - 20, y + 3, 17, 8, 1.4, 1.4, "F");
    text(BLACK, 7.3, "bold"); pdf.text(`${number.format(campaign.leads)} leads`, W - PAD - 11.5, y + 7, { align: "center", baseline: "middle" });
    text(BLACK, 6.2); pdf.text(`${money.format(campaign.spend)}  |  CPL ${campaign.leads ? money.format(campaign.cpl) : "-"}  |  CTR ${campaign.ctr.toFixed(2)}%`, PAD + 13, y + 19.5);
    y += h + 3;
  });

  const pages = pdf.getNumberOfPages();
  for (let page = 2; page <= pages; page += 1) {
    pdf.setPage(page); pdf.setDrawColor(...GRAY_LIGHT); pdf.line(PAD, 183, W - PAD, 183);
    text(BLACK, 5.3); pdf.text("GENESY · Relatório de tráfego pago", PAD, 188); pdf.text(`${page}/${pages}`, W - PAD, 188, { align: "right" });
  }
  return pdf;
}

export async function saveTrafficReportPdf(data: TrafficReportData, fileHandle?: TrafficReportFileHandle) {
  const assets = await loadAssets();
  const pdf = createTrafficReportPdf(data, assets);
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(pdf.output("blob"));
    await writable.close();
    return;
  }
  pdf.save(trafficReportFilename(data.clientName, data.since, data.until));
}
