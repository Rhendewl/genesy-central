import { jsPDF } from "jspdf";
import { trafficReportFilename } from "@/lib/traffic-report";
import type { TrafficReportCampaign, TrafficReportData } from "@/types/traffic-report";

type RGB = [number, number, number];
export type TrafficReportPdfAssets = { logoDark: string; logoLight: string; lightFont: string; mediumFont: string };

const W = 108;
const H = 192;
const PAD = 8;
const CW = W - PAD * 2;
const INK: RGB = [14, 17, 20];
const MUTED: RGB = [91, 101, 111];
const LINE: RGB = [222, 227, 231];
const SURFACE: RGB = [245, 247, 249];
const BLUE: RGB = [39, 163, 255];
const DEEP_BLUE: RGB = [25, 102, 174];
const GREEN: RGB = [24, 143, 91];
const AMBER: RGB = [191, 122, 22];

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
    pdf.addImage(assets.logoDark, "PNG", PAD, 7, 27, 5.9);
    text(MUTED, 4.8, "bold"); pdf.text(clean(eyebrow).toUpperCase(), W - PAD, 10.8, { align: "right" });
    pdf.setDrawColor(...LINE); pdf.line(PAD, 16, W - PAD, 16);
    text(INK, 14, "bold"); pdf.text(wrap(title, CW), PAD, 25);
    y = 34;
  };
  const section = (title: string, subtitle?: string) => {
    text(INK, 9.5, "bold"); pdf.text(clean(title), PAD, y);
    if (subtitle) { text(MUTED, 5.2); pdf.text(clean(subtitle), PAD, y + 4); y += 5; }
    y += 6;
  };

  // Capa
  pdf.setFillColor(3, 5, 7); pdf.rect(0, 0, W, H, "F");
  pdf.setFillColor(9, 16, 22); pdf.circle(W + 4, 5, 52, "F");
  pdf.setFillColor(7, 12, 17); pdf.circle(-5, H - 7, 48, "F");
  pdf.addImage(assets.logoLight, "PNG", PAD, 10, 29, 6.3);
  text([119, 132, 143], 5.2, "bold"); pdf.text("RELATÓRIO EXECUTIVO", PAD, 62);
  text([255, 255, 255], 22, "bold");
  const coverTitle = wrap("Tráfego Pago", 78); pdf.text(coverTitle, PAD, 75);
  text([39, 163, 255], 12, "bold"); pdf.text(wrap(data.clientName, 88).slice(0, 2), PAD, 91);
  text([178, 188, 197], 7); pdf.text(`${date(data.since)} a ${date(data.until)}`, PAD, 111);
  if (data.accountName) { text([120, 132, 142], 5.7); pdf.text(wrap(data.accountName, 82), PAD, 119); }
  pdf.setDrawColor(39, 163, 255); pdf.setLineWidth(1.1); pdf.line(PAD, 132, 34, 132);
  text([107, 119, 129], 5.2); pdf.text("Performance de mídia, campanhas e criativos", PAD, 140);
  text([74, 84, 92], 4.7); pdf.text(`Gerado em ${new Date(data.generatedAt).toLocaleDateString("pt-BR")}`, PAD, H - 10);

  // Resumo em quadrantes
  addPage(); header("Performance do período", "Resumo executivo");
  const main = [
    { label: "VALOR INVESTIDO", value: money.format(data.metrics.spend), fill: INK, color: [255, 255, 255] as RGB },
    { label: "LEADS GERADOS", value: number.format(data.metrics.leads), fill: BLUE, color: [255, 255, 255] as RGB },
    { label: "CUSTO POR LEAD", value: data.metrics.leads ? money.format(data.metrics.cpl) : "-", fill: DEEP_BLUE, color: [255, 255, 255] as RGB },
    { label: "CTR (TAXA DE CLIQUES)", value: `${data.metrics.ctr.toFixed(2)}%`, fill: [25, 31, 37] as RGB, color: [255, 255, 255] as RGB },
  ];
  const boxW = (CW - 3) / 2; const boxH = 31;
  main.forEach((metric, index) => {
    const x = PAD + (index % 2) * (boxW + 3); const boxY = y + Math.floor(index / 2) * (boxH + 3);
    pdf.setFillColor(...metric.fill); pdf.roundedRect(x, boxY, boxW, boxH, 3, 3, "F");
    text(metric.color, 5, "bold"); pdf.text(metric.label, x + 4, boxY + 8);
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
    pdf.setFillColor(...SURFACE); pdf.setDrawColor(...LINE); pdf.roundedRect(x, boxY, smallW, 17, 2, 2, "FD");
    text(MUTED, 4.4, "bold"); pdf.text(label, x + 3, boxY + 5);
    text(INK, value.length > 12 ? 6.6 : 8.2, "bold"); pdf.text(value, x + 3, boxY + 12.2);
  });

  // Campanhas
  addPage(); header("Ranking de performance", "Melhores campanhas");
  if (!data.campaigns.length) { text(MUTED, 7); pdf.text("Nenhuma campanha com dados no período.", PAD, y); }
  data.campaigns.slice(0, 6).forEach((campaign, index) => {
    const h = 22;
    pdf.setFillColor(...(index === 0 ? [239, 248, 255] as RGB : SURFACE)); pdf.setDrawColor(...(index === 0 ? [185, 222, 248] as RGB : LINE));
    pdf.roundedRect(PAD, y, CW, h, 2.5, 2.5, "FD");
    pdf.setFillColor(...(index === 0 ? BLUE : [210, 216, 222] as RGB)); pdf.circle(PAD + 5, y + 6, 2.6, "F");
    text(index === 0 ? [255, 255, 255] : MUTED, 5.8, "bold"); pdf.text(String(index + 1), PAD + 5, y + 7.7, { align: "center" });
    text(INK, 6.7, "bold"); pdf.text(wrap(campaign.name, 69).slice(0, 2), PAD + 10, y + 6);
    text(BLUE, 6.2, "bold"); pdf.text(`${number.format(campaign.leads)} leads`, W - PAD - 3, y + 6, { align: "right" });
    text(MUTED, 5.1); pdf.text(`${money.format(campaign.spend)}  |  CPL ${campaign.leads ? money.format(campaign.cpl) : "-"}  |  CTR ${campaign.ctr.toFixed(2)}%`, PAD + 10, y + 17);
    y += h + 3;
  });

  // Criativos
  const creatives = data.creatives.slice(0, 4);
  if (!creatives.length) {
    addPage(); header("Conteúdo visual", "Criativos em destaque");
    text(MUTED, 7); pdf.text(wrap("As campanhas do período ainda não possuem miniaturas sincronizadas. Sincronize novamente a conta Meta para incluí-las no próximo relatório."), PAD, y);
  } else {
    creatives.forEach((creative, index) => {
      if (index % 2 === 0) { addPage(); header("Conteúdo visual", "Criativos em destaque"); }
      drawCreative(pdf, creative, index, assets, y, text, wrap);
      y += 68;
    });
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 2; page <= pages; page += 1) {
    pdf.setPage(page); pdf.setDrawColor(...LINE); pdf.line(PAD, 183, W - PAD, 183);
    text(MUTED, 4.5); pdf.text("GENESY · Relatório de tráfego pago", PAD, 188); pdf.text(`${page}/${pages}`, W - PAD, 188, { align: "right" });
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
  pdf.setFillColor(...SURFACE); pdf.setDrawColor(...LINE); pdf.roundedRect(PAD, y, CW, 62, 3, 3, "FD");
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
    catch { pdf.setFillColor(225, 230, 234); pdf.roundedRect(PAD + 2, y + 2, CW - 4, imageH, 2, 2, "F"); }
  } else { pdf.setFillColor(225, 230, 234); pdf.roundedRect(PAD + 2, y + 2, CW - 4, imageH, 2, 2, "F"); }
  pdf.setFillColor(...BLUE); pdf.circle(PAD + 7, y + 45, 3, "F");
  setText([255, 255, 255], 6, "bold"); pdf.text(String(index + 1), PAD + 7, y + 47, { align: "center" });
  setText(INK, 6.7, "bold"); pdf.text(wrap(creative.name, 67).slice(0, 2), PAD + 13, y + 44);
  setText(BLUE, 6.2, "bold"); pdf.text(`${number.format(creative.leads)} leads`, W - PAD - 3, y + 45, { align: "right" });
  setText(MUTED, 5); pdf.text(`${money.format(creative.spend)}  |  CPL ${creative.leads ? money.format(creative.cpl) : "-"}  |  CTR ${creative.ctr.toFixed(2)}%`, PAD + 13, y + 57);
}

export async function saveTrafficReportPdf(data: TrafficReportData) {
  const assets = await loadAssets();
  createTrafficReportPdf(data, assets).save(trafficReportFilename(data.clientName, data.since, data.until));
}
