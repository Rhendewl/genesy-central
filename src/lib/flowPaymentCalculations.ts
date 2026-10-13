/** Percentagens e parcelas padrão (referência Lancaster / fluxo de obra). */

export type FlowPaymentState = {
  pctEntrada: number;
  pctMensais: number;
  pctIntercaladas: number;
  pctChaves: number;
  parcelasEntrada: number;
  parcelasMensais: number;
  parcelasIntercaladas: number;
  parcelasChaves: number;
};

export const DEFAULT_FLOW_PAYMENT: FlowPaymentState = {
  pctEntrada: 10,
  pctMensais: 25,
  pctIntercaladas: 25,
  pctChaves: 40,
  parcelasEntrada: 1,
  parcelasMensais: 48,
  parcelasIntercaladas: 8,
  parcelasChaves: 1,
};

export function sumFlowPercentages(state: FlowPaymentState): number {
  return roundFlowPercentage(state.pctEntrada + state.pctMensais + state.pctIntercaladas + state.pctChaves);
}

export function consolidatedAmountForPercentages(valorTotal: number, state: FlowPaymentState): number {
  return Number(valorTotal) * (sumFlowPercentages(state) / 100);
}

export type FlowBucket = {
  pct: number;
  parcelas: number;
  totalFase: number;
  valorParcela: number;
};

export type FlowBuckets = {
  entrada: FlowBucket;
  mensais: FlowBucket;
  intercaladas: FlowBucket;
  chaves: FlowBucket;
};

/**
 * Por fase: totalFase = valorTotal × (pct/100); valorParcela = totalFase ÷ parcelas.
 */
export function computeFlowBuckets(valorTotal: number, state: FlowPaymentState): FlowBuckets {
  const {
    pctEntrada,
    pctMensais,
    pctIntercaladas,
    pctChaves,
    parcelasEntrada,
    parcelasMensais,
    parcelasIntercaladas,
    parcelasChaves,
  } = state;

  const bucket = (pct: number, parcelas: number): FlowBucket => {
    const totalFase = valorTotal * (pct / 100);
    const valorParcela = parcelas > 0 ? totalFase / parcelas : 0;
    return { pct, parcelas, totalFase, valorParcela };
  };

  return {
    entrada: bucket(pctEntrada, parcelasEntrada),
    mensais: bucket(pctMensais, parcelasMensais),
    intercaladas: bucket(pctIntercaladas, parcelasIntercaladas),
    chaves: bucket(pctChaves, parcelasChaves),
  };
}


/** Suppress floating-point noise while retaining sub-cent calculation precision. */
export function roundFlowPercentage(value: number): number {
  return Math.round(value * 1e10) / 1e10;
}

export function percentageForInstallment(valorTotal: number, parcelas: number, valorParcela: number): number {
  if (!Number.isFinite(valorTotal) || valorTotal <= 0 || !Number.isFinite(parcelas) || parcelas < 1 || !Number.isFinite(valorParcela) || valorParcela < 0) return 0;
  return roundFlowPercentage((valorParcela * parcelas / valorTotal) * 100);
}

export function formatFlowPercentage(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);
}
