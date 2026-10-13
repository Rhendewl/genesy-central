import { jsPDF } from 'jspdf';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatPct = (val: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(val);

export type FlowPaymentPdfRow = {
  label: string;
  pct: number;
  parcelas: number;
  totalFase: number;
  valorParcela: number;
};

export type FlowPaymentPdfPayload = {
  projectName: string;
  unit: string;
  clientName?: string;
  brokerName?: string;
  creci?: string;
  valorTotal: number;
  rows: FlowPaymentPdfRow[];
};

/** Builds the same document used by the download, allowing visual verification. */
export function createFlowPaymentPDF(payload: FlowPaymentPdfPayload): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const width = doc.internal.pageSize.getWidth();
  const margin = 19;
  const usable = width - margin * 2;
  let y = 0;
  const ink = [28, 31, 34] as const;
  const muted = [108, 114, 120] as const;
  const paper = [248, 249, 250] as const;
  const background = () => { doc.setFillColor(...paper); doc.rect(0, 0, width, 297, 'F'); };
  const textStyle = (size: number, bold = false, color: readonly [number, number, number] = ink) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
  };
  const ensureSpace = (height: number) => {
    if (y + height > 280) { doc.addPage(); background(); y = 22; }
  };
  const fitted = (text: string, x: number, baseline: number, maxWidth: number, size: number, bold = false, align: 'left' | 'right' = 'left', color: readonly [number, number, number] = ink) => {
    textStyle(size, bold, color);
    while (doc.getTextWidth(text) > maxWidth && size > 6) { size -= .5; doc.setFontSize(size); }
    doc.text(text, x, baseline, { align });
  };
  const wrappedText = (text: string, maxWidth: number, size: number, bold = false) => {
    textStyle(size, bold);
    return doc.splitTextToSize(text, maxWidth) as string[];
  };

  background();
  doc.setFillColor(17, 20, 23); doc.rect(0, 0, width, 43, 'F');
  textStyle(9, true, [210, 217, 223]); doc.text('GENESY', margin, 13);
  textStyle(24, true, [255, 255, 255]); doc.text('Fluxo de pagamento', margin, 27);
  textStyle(9, false, [179, 188, 196]); doc.text('SIMULAÇÃO IMOBILIÁRIA', margin, 35);

  y = 51;
  textStyle(8, true, muted); doc.text('EMPREENDIMENTO', margin, y);
  y += 8;
  const projectLines = wrappedText(payload.projectName.trim() || 'Empreendimento', usable, 20, true);
  for (const line of projectLines) {
    ensureSpace(9); textStyle(20, true); doc.text(line, margin, y); y += 8;
  }
  y += 2;
  const clientLines = wrappedText(payload.clientName?.trim() || 'Não informado', usable * .62 - 10, 11);
  const unitLines = wrappedText(payload.unit.trim() || 'Não informada', usable * .38 - 10, 11);
  const infoHeight = Math.max(clientLines.length, unitLines.length) * 5 + 17;
  ensureSpace(infoHeight + 8);
  doc.setFillColor(255, 255, 255); doc.roundedRect(margin, y, usable, infoHeight, 3, 3, 'F');
  textStyle(7.5, true, muted);
  doc.text('PREPARADO PARA', margin + 7, y + 8); doc.text('UNIDADE', margin + usable * .62, y + 8);
  textStyle(11); doc.text(clientLines, margin + 7, y + 15); doc.text(unitLines, margin + usable * .62, y + 15);
  y += infoHeight + 8;

  ensureSpace(36);
  doc.setFillColor(225, 231, 235); doc.roundedRect(margin, y, usable, 31, 3, 3, 'F');
  textStyle(8, true, muted); doc.text('VALOR TOTAL DO IMÓVEL', margin + 8, y + 9);
  fitted(formatCurrency(payload.valorTotal), margin + 8, y + 23, usable - 16, 26, true);
  y += 40;

  const tableHeader = () => {
    textStyle(12, true); doc.text('Condições de pagamento', margin, y);
    y += 9;
    textStyle(7, true, muted);
    doc.text('FASE / PERCENTUAL', margin + 5, y);
    doc.text('PARCELAS', 94, y, { align: 'right' });
    doc.text('TOTAL DA FASE', 139, y, { align: 'right' });
    doc.text('VALOR POR PARCELA', width - margin - 5, y, { align: 'right' });
    y += 4;
  };
  ensureSpace(42); tableHeader();
  payload.rows.forEach((row, index) => {
    if (y + 19 > 280) { doc.addPage(); background(); y = 22; tableHeader(); }
    const rowFill: [number, number, number] = index % 2 === 0 ? [255, 255, 255] : [239, 242, 244];
    doc.setFillColor(...rowFill);
    doc.roundedRect(margin, y, usable, 17, 2, 2, 'F');
    fitted(row.label, margin + 5, y + 8, 44, 10, true);
    fitted(`${formatPct(row.pct)}% do imóvel`, margin + 5, y + 14, 44, 8, false, 'left', muted);
    fitted(`${row.parcelas}x`, 94, y + 11, 23, 11, true, 'right');
    fitted(formatCurrency(row.totalFase), 139, y + 11, 40, 9, false, 'right');
    fitted(formatCurrency(row.valorParcela), width - margin - 5, y + 11, 42, 12, true, 'right');
    y += 19;
  });

  const broker = payload.brokerName?.trim();
  const creci = payload.creci?.trim();
  if (broker || creci) {
    const brokerLines = wrappedText(broker || 'Corretor não informado', usable - 14, 11, true);
    const creciLines = creci ? wrappedText(`CRECI: ${creci}`, usable - 14, 9) : [];
    const height = 16 + brokerLines.length * 5 + creciLines.length * 4;
    ensureSpace(height + 6); y += 4;
    doc.setDrawColor(217, 223, 228); doc.line(margin, y, width - margin, y);
    textStyle(7.5, true, muted); doc.text('SEU CORRETOR', margin, y + 8);
    textStyle(11, true); doc.text(brokerLines, margin, y + 15);
    if (creciLines.length) { textStyle(9, false, muted); doc.text(creciLines, margin, y + 15 + brokerLines.length * 5); }
    y += height;
  }
  const note = 'Simulação de pagamento. Valores por parcela calculados sobre o percentual de cada fase, sem aplicação de juros ou correções.';
  const noteLines = wrappedText(note, usable, 8);
  ensureSpace(noteLines.length * 4 + 8); y += 6;
  textStyle(8, false, muted); doc.text(noteLines, margin, y);
  return doc;
}

export async function generateFlowPaymentPDF(payload: FlowPaymentPdfPayload): Promise<void> {
  const doc = createFlowPaymentPDF(payload);
  const safeName = (payload.projectName || 'Empreendimento')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Empreendimento';
  doc.save(`Fluxo_pagamento_${safeName}.pdf`);
}
