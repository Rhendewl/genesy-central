import { jsPDF } from "jspdf";

type RGB = [number, number, number];

export type VgvCommercialReportData = {
  clientName: string;
  since: string;
  until: string;
  generatedAt: string;
  metrics: {
    spend: number;
    totalVgv: number;
    grossCommission: number;
    agencyCommission: number;
    count: number;
    averageTicket: number;
    leads: number;
    cpl: number;
    cac: number;
    conversionRate: number;
    roas: number;
    commercialRoas: number;
  };
};

export type VgvCommercialReportPdfAssets = { logoLight: string; lightFont: string; mediumFont: string };
export type VgvCommercialReportFileHandle = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
};

const W = 108;
const H = 192;
const PAD = 8;
const CW = W - PAD * 2;
const BLACK: RGB = [7, 8, 9];
const WHITE: RGB = [255, 255, 255];
const GRAY_1: RGB = [25, 27, 29];
const GRAY_2: RGB = [49, 53, 56];
const GRAY_3: RGB = [93, 101, 106];
const GRAY_4: RGB = [172, 178, 182];
const GRAY_LIGHT: RGB = [203, 208, 211];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
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

async function logoDataUrl() {
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
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadAssets(): Promise<VgvCommercialReportPdfAssets> {
  const [logoLight, light, medium] = await Promise.all([
    logoDataUrl(),
    fetch("/brand/tt-firs-neue-light.ttf"),
    fetch("/brand/tt-firs-neue-medium.ttf"),
  ]);
  if (!light.ok || !medium.ok) throw new Error("Não foi possível carregar a fonte da marca");
  return { logoLight, lightFont: bufferToBase64(await light.arrayBuffer()), mediumFont: bufferToBase64(await medium.arrayBuffer()) };
}

export function vgvCommercialReportFilename(clientName: string, since: string, until: string) {
  const slug = clean(clientName).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "cliente";
  return `relatorio-comercial-${slug}-${since}-a-${until}.pdf`;
}

export function createVgvCommercialReportPdf(data: VgvCommercialReportData, assets: VgvCommercialReportPdfAssets) {
  const pdf = new jsPDF({ unit: "mm", format: [W, H], orientation: "portrait" });
  pdf.addFileToVFS("tt-firs-light.ttf", assets.lightFont);
  pdf.addFont("tt-firs-light.ttf", "TTFirsNeue", "normal");
  pdf.addFileToVFS("tt-firs-medium.ttf", assets.mediumFont);
  pdf.addFont("tt-firs-medium.ttf", "TTFirsNeue", "bold");

  const text = (color: RGB, size: number, style: "normal" | "bold" = "normal") => {
    pdf.setTextColor(...color); pdf.setFont("TTFirsNeue", style); pdf.setFontSize(size);
  };
  const wrap = (value: unknown, width = CW) => pdf.splitTextToSize(clean(value), width) as string[];
  const background = () => { pdf.setFillColor(...BLACK); pdf.rect(0, 0, W, H, "F"); };

  // Capa
  background();
  pdf.addImage(assets.logoLight, "PNG", PAD, 10, 31, 6.8);
  text(GRAY_4, 7.2, "bold"); pdf.text("RELATÓRIO EXECUTIVO", PAD, 53);
  text(WHITE, 24, "bold"); pdf.text(wrap("Performance comercial", 90), PAD, 70);
  text(WHITE, 15, "bold"); pdf.text(wrap(data.clientName, 90).slice(0, 2), PAD, 101);
  text(GRAY_4, 9); pdf.text(`${date(data.since)} a ${date(data.until)}`, PAD, 121);
  pdf.setDrawColor(...GRAY_3); pdf.setLineWidth(1); pdf.line(PAD, 139, 37, 139);
  text(WHITE, 7.5); pdf.text("Vendas, mídia e retorno comercial", PAD, 150);
  text(GRAY_4, 6.2); pdf.text(`Gerado em ${new Date(data.generatedAt).toLocaleDateString("pt-BR")}`, PAD, H - 10);

  // Métricas
  pdf.addPage([W, H], "portrait"); background();
  pdf.addImage(assets.logoLight, "PNG", PAD, 8, 28, 6.1);
  text(GRAY_4, 5.7, "bold"); pdf.text("MÉTRICAS DO PERÍODO", W - PAD, 12, { align: "right" });
  pdf.setDrawColor(...GRAY_2); pdf.setLineWidth(.7); pdf.line(PAD, 18, W - PAD, 18);
  text(WHITE, 12.5, "bold"); pdf.text(wrap(data.clientName, 70).slice(0, 2), PAD, 27);
  text(GRAY_4, 6.8); pdf.text(`${date(data.since)} a ${date(data.until)}`, PAD, 38);

  const main = [
    ["INVESTIMENTO", money.format(data.metrics.spend)],
    ["VGV", money.format(data.metrics.totalVgv)],
    ["VGC", money.format(data.metrics.grossCommission)],
  ];
  const mainH = 17;
  main.forEach(([label, value], index) => {
    const y = 45 + index * (mainH + 2);
    pdf.setFillColor(...GRAY_LIGHT); pdf.roundedRect(PAD, y, CW, mainH, 2, 2, "F");
    text(BLACK, 5.8, "bold"); pdf.text(label, PAD + 4, y + 9, { baseline: "middle" });
    text(BLACK, value.length > 16 ? 9 : 10.5, "bold"); pdf.text(value, W - PAD - 4, y + 8.7, { align: "right", baseline: "middle" });
  });

  const secondary = [
    ["VENDAS", integer.format(data.metrics.count)],
    ["TICKET MÉDIO", money.format(data.metrics.averageTicket)],
    ["LEADS", integer.format(data.metrics.leads)],
    ["CPL", data.metrics.leads ? money.format(data.metrics.cpl) : "-"],
    ["CAC", data.metrics.count && data.metrics.spend ? money.format(data.metrics.cac) : "-"],
    ["CONVERSÃO", data.metrics.leads ? `${data.metrics.conversionRate.toFixed(2)}%` : "-"],
    ["ROAS VGV", data.metrics.spend ? `${data.metrics.roas.toFixed(1)}x` : "-"],
    ["ROAS VGC", data.metrics.spend ? `${data.metrics.commercialRoas.toFixed(1)}x` : "-"],
  ];
  const boxW = (CW - 3) / 2;
  secondary.forEach(([label, value], index) => {
    const x = PAD + (index % 2) * (boxW + 3);
    const y = 105 + Math.floor(index / 2) * 14.5;
    pdf.setFillColor(...GRAY_1); pdf.roundedRect(x, y, boxW, 12.5, 1.5, 1.5, "F");
    text(GRAY_4, 4.8, "bold"); pdf.text(label, x + 3, y + 4.5);
    text(WHITE, value.length > 15 ? 6.8 : 8.2, "bold"); pdf.text(value, x + 3, y + 10);
  });

  const roasText = data.metrics.spend
    ? `A cada R$ 1 investido, voltaram ${money.format(data.metrics.commercialRoas)} em comissão.`
    : "Cadastre o investimento para visualizar o retorno sobre a comissão.";
  pdf.setFillColor(...GRAY_2); pdf.roundedRect(PAD, 166, CW, 13, 1.8, 1.8, "F");
  text(WHITE, 6.1, "bold"); pdf.text(wrap(roasText, CW - 8), PAD + 4, 171.5);
  text(GRAY_4, 4.9); pdf.text("VGC: valor geral de comissão gerada no período.", PAD + 4, 176.5);

  pdf.setDrawColor(...GRAY_2); pdf.line(PAD, 183, W - PAD, 183);
  text(GRAY_4, 5.3); pdf.text("GENESY · Relatório de performance comercial", PAD, 188); pdf.text("2/2", W - PAD, 188, { align: "right" });
  return pdf;
}

export async function saveVgvCommercialReportPdf(data: VgvCommercialReportData, fileHandle: VgvCommercialReportFileHandle) {
  const assets = await loadAssets();
  const pdf = createVgvCommercialReportPdf(data, assets);
  const writable = await fileHandle.createWritable();
  await writable.write(pdf.output("blob"));
  await writable.close();
}
