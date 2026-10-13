import { describe, expect, it } from 'vitest';
import { computeFlowBuckets, consolidatedAmountForPercentages, DEFAULT_FLOW_PAYMENT, sumFlowPercentages, percentageForInstallment } from '../flowPaymentCalculations';

describe('fluxo de pagamento — fórmulas de referência', () => {
  it('distribui R$ 500 mil nas quatro fases padrão', () => {
    const b = computeFlowBuckets(500000, DEFAULT_FLOW_PAYMENT);
    expect(Object.values(b).map(v => [v.totalFase, v.parcelas, v.valorParcela])).toEqual([
      [50000, 1, 50000], [125000, 48, 125000 / 48], [125000, 8, 15625], [200000, 1, 200000],
    ]);
    expect(sumFlowPercentages(DEFAULT_FLOW_PAYMENT)).toBe(100);
  });
  it('não redistribui nem limita percentuais cuja soma excede 100%', () => {
    const flow = { ...DEFAULT_FLOW_PAYMENT, pctEntrada: 30 };
    expect(sumFlowPercentages(flow)).toBe(120);
    expect(computeFlowBuckets(500000, flow).entrada.totalFase).toBe(150000);
    expect(consolidatedAmountForPercentages(500000, flow)).toBe(600000);
  });
  it('preserva precisão antes de formatar e protege divisão por zero', () => {
    const b = computeFlowBuckets(100001, { ...DEFAULT_FLOW_PAYMENT, pctEntrada: 0, parcelasMensais: 0, parcelasChaves: 3 });
    expect(b.entrada.totalFase).toBe(0);
    expect(b.mensais.valorParcela).toBe(0);
    expect(b.chaves.valorParcela).toBeCloseTo(100001 * .4 / 3, 10);
  });
});

describe('edição por valor da parcela', () => {
  it('deriva o percentual sem alterar as demais fases', () => {
    const pct = percentageForInstallment(500000, 48, 1500.01);
    expect(pct).toBe(14.400096);
    const b = computeFlowBuckets(500000, { ...DEFAULT_FLOW_PAYMENT, pctMensais: pct });
    expect(b.mensais.valorParcela).toBeCloseTo(1500.01, 8);
    expect(b.chaves.pct).toBe(40);
  });
  it('aceita valores que excedem o total para permitir os avisos e trata entradas inválidas', () => {
    expect(percentageForInstallment(500000, 48, 12000)).toBe(115.2);
    expect(percentageForInstallment(0, 48, 1000)).toBe(0);
    expect(percentageForInstallment(500000, 0, 1000)).toBe(0);
    expect(percentageForInstallment(500000, 48, -1)).toBe(0);
    expect(percentageForInstallment(500000, 48, NaN)).toBe(0);
  });
});
