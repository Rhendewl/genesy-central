import { describe, expect, it, vi } from 'vitest';
import { generateFlowPaymentPDF } from '../flowPaymentPdf';
import { computeFlowBuckets, DEFAULT_FLOW_PAYMENT } from '@/lib/flowPaymentCalculations';

const captured = vi.hoisted(() => ({ names: [] as string[], docs: [] as Array<import('jspdf').jsPDF> }));
vi.mock('jspdf', async (original) => {
  const actual = await original<typeof import('jspdf')>();
  return { jsPDF: class extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      this.save = ((name: string) => { captured.names.push(name); return this; }) as unknown as typeof this.save;
      captured.docs.push(this);
    }
  } };
});

describe('PDF real do fluxo', () => {
  it('gera A4 retrato, quatro fases e nome sanitizado sem rodapé', async () => {
    const buckets = computeFlowBuckets(500000, { ...DEFAULT_FLOW_PAYMENT, pctEntrada: 0 });
    const labels = ['Entrada', 'Mensais', 'Intercaladas', 'Chaves'];
    await generateFlowPaymentPDF({ projectName: 'Vista Park Résidence', unit: '101', clientName: 'Marina Silva', brokerName: 'Bruno Costa', creci: '12345-F / CE', valorTotal: 500000, rows: Object.values(buckets).map((b, i) => ({ label: labels[i], ...b })) });
    expect(captured.names.at(-1)).toBe('Fluxo_pagamento_Vista_Park_Residence.pdf');
    const doc = captured.docs.at(-1)!;
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 0);
    expect(doc.getNumberOfPages()).toBe(1);
    const content = doc.output();
    expect(content.startsWith('%PDF-')).toBe(true);
    expect(content).toContain('Entrada');
    expect(content).toContain('0% do im');
    expect(content).toContain('Mensais');
    expect(content).toContain('48x');
    expect(content).toContain('Fluxo de pagamento');
    expect(content).toContain('VALOR TOTAL DO IM');
    expect(content).not.toContain('Gerado por');
    expect(content).toContain('Marina Silva');
    expect(content).toContain('Bruno Costa');
    expect(content).toContain('CRECI: 12345-F / CE');
  });
});
