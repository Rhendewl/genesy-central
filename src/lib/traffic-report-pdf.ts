import { jsPDF } from "jspdf";
import { trafficReportFilename } from "@/lib/traffic-report";
import type { TrafficReportCampaign, TrafficReportData } from "@/types/traffic-report";

type RGB = [number, number, number];
export type TrafficReportPdfAssets = { logoDark: string; logoLight: string; lightFont: string; mediumFont: string };

const W = 108;
const H = 192;
const PAD = 8;
const CW = W - PAD * 2;
const BLACK: RGB = [8, 9, 10];
const WHITE: RGB = [255, 255, 255];
const GRAY_DARK: RGB = [123, 135, 142];
const GRAY_LIGHT: RGB = [175, 184, 192];
const SURFACE: RGB = [241, 243, 244];
const GOLD: RGB = [184, 145, 62];
const SILVER: RGB = [154, 163, 171];
const BRONZE: RGB = [166, 105, 63];

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

function imageFormat(dataUrl: string) {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
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
  pdf.setFillColor(...GRAY_DARK); pdf.roundedRect(W - 40, -10, 54, 62, 8, 8, "F");
  pdf.setFillColor(25, 27, 29); pdf.roundedRect(-17, H - 47, 58, 62, 8, 8, "F");
  pdf.addImage(assets.logoLight, "PNG", PAD, 10, 29, 6.3);
  text(WHITE, 6.2, "bold"); pdf.text("RELATÓRIO EXECUTIVO", PAD, 62);
  text(WHITE, 22, "bold");
  const coverTitle = wrap("Tráfego Pago", 78); pdf.text(coverTitle, PAD, 75);
  text(WHITE, 12, "bold"); pdf.text(wrap(data.clientName, 88).slice(0, 2), PAD, 91);
  text(WHITE, 8); pdf.text(`${date(data.since)} a ${date(data.until)}`, PAD, 111);
  if (data.accountName) { text(WHITE, 6.4); pdf.text(wrap(data.accountName, 82), PAD, 120); }
  pdf.setDrawColor(...GRAY_LIGHT); pdf.setLineWidth(1.1); pdf.line(PAD, 133, 34, 133);
  text(WHITE, 6); pdf.text("Performance de mídia, campanhas e criativos", PAD, 142);
  text(WHITE, 5.5); pdf.text(`Gerado em ${new Date(data.generatedAt).toLocaleDateString("pt-BR")}`, PAD, H - 10);

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
    const h = 22;
    pdf.setFillColor(...SURFACE); pdf.setDrawColor(...GRAY_LIGHT);
    pdf.roundedRect(PAD, y, CW, h, 2, 2, "FD");
    const podium = index === 0 ? GOLD : index === 1 ? SILVER : index === 2 ? BRONZE : GRAY_DARK;
    pdf.setFillColor(...podium); pdf.roundedRect(PAD + 2.5, y + 2.5, 7, 7, 1.4, 1.4, "F");
    text(index === 1 ? BLACK : WHITE, 6.2, "bold"); pdf.text(String(index + 1), PAD + 6, y + 7.45, { align: "center" });
    text(BLACK, 7.2, "bold"); pdf.text(wrap(campaign.name, 67).slice(0, 2), PAD + 12, y + 6.5);
    text(BLACK, 6.7, "bold"); pdf.text(`${number.format(campaign.leads)} leads`, W - PAD - 3, y + 6.5, { align: "right" });
    text(BLACK, 6.2); pdf.text(`${money.format(campaign.spend)}  |  CPL ${campaign.leads ? money.format(campaign.cpl) : "-"}  |  CTR ${campaign.ctr.toFixed(2)}%`, PAD + 12, y + 17.5);
    y += h + 3;
  });

  // Criativos
  const creatives = data.creatives;
  if (!creatives.length) {
    addPage(); header("Conteúdo visual", "Criativos em destaque");
    text(BLACK, 7); pdf.text(wrap("As campanhas do período ainda não possuem miniaturas sincronizadas. Sincronize novamente a conta Meta para incluí-las no próximo relatório."), PAD, y);
  } else {
    creatives.forEach((creative, index) => {
      if (index % 2 === 0) { addPage(); header("Conteúdo visual", "Criativos em destaque"); }
      drawCreative(pdf, creative, index, assets, y, text, wrap);
      y += 68;
    });
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 2; page <= pages; page += 1) {
    pdf.setPage(page); pdf.setDrawColor(...GRAY_LIGHT); pdf.line(PAD, 183, W - PAD, 183);
    text(BLACK, 5.3); pdf.text("GENESY · Relatório de tráfego pago", PAD, 188); pdf.text(`${page}/${pages}`, W - PAD, 188, { align: "right" });
  }
  return pdf;
}

function drawCreative(
  pdf: jsPDF,
  creative: TrafficReportCampaign,
  index: number,
  _assets: TrafficReportPdfAssets,
  y: number,
  setText: (color: RGB, size: number, style?: "normal" | "bold") => void,
  wrap: (value: unknown, width?: number) => string[],
) {
  const imageH = 37;
  pdf.setFillColor(...SURFACE); pdf.setDrawColor(...GRAY_LIGHT); pdf.roundedRect(PAD, y, CW, 62, 2, 2, "FD");
  if (creative.thumbnailDataUrl) {
    try {
      const boxX = PAD + 2; const boxY = y + 2; const boxW = CW - 4;
      const properties = pdf.getImageProperties(creative.thumbnailDataUrl);
      const imageRatio = properties.width / properties.height;
      const boxRatio = boxW / imageH;
      const imageW = imageRatio > boxRatio ? boxW : imageH * imageRatio;
      const renderedH = imageRatio > boxRatio ? boxW / imageRatio : imageH;
      pdf.addImage(creative.thumbnailDataUrl, imageFormat(creative.thumbnailDataUrl), boxX + (boxW - imageW) / 2, boxY + (imageH - renderedH) / 2, imageW, renderedH, `creative-${creative.id}`, "FAST");
    }
    catch { drawMissingThumbnail(pdf, y, setText); }
  } else { drawMissingThumbnail(pdf, y, setText); }
  const podium = index === 0 ? GOLD : index === 1 ? SILVER : index === 2 ? BRONZE : GRAY_DARK;
  pdf.setFillColor(...podium); pdf.roundedRect(PAD + 3.5, y + 41.5, 7, 7, 1.4, 1.4, "F");
  setText(index === 1 ? BLACK : WHITE, 6.2, "bold"); pdf.text(String(index + 1), PAD + 7, y + 46.45, { align: "center" });
  setText(BLACK, 7.1, "bold"); pdf.text(wrap(creative.name, 65).slice(0, 2), PAD + 13, y + 44.5);
  setText(BLACK, 6.7, "bold"); pdf.text(`${number.format(creative.leads)} leads`, W - PAD - 3, y + 45, { align: "right" });
  setText(BLACK, 6.2); pdf.text(`${money.format(creative.spend)}  |  CPL ${creative.leads ? money.format(creative.cpl) : "-"}  |  CTR ${creative.ctr.toFixed(2)}%`, PAD + 13, y + 57.5);
}

function drawMissingThumbnail(pdf: jsPDF, y: number, setText: (color: RGB, size: number, style?: "normal" | "bold") => void) {
  pdf.setFillColor(...GRAY_LIGHT); pdf.roundedRect(PAD + 2, y + 2, CW - 4, 37, 1.5, 1.5, "F");
  setText(BLACK, 6, "bold"); pdf.text("MINIATURA INDISPONÍVEL", W / 2, y + 22, { align: "center" });
}

export async function saveTrafficReportPdf(data: TrafficReportData) {
  const assets = await loadAssets();
  createTrafficReportPdf(data, assets).save(trafficReportFilename(data.clientName, data.since, data.until));
}
