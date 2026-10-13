"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/app/calculadora/calculadora.module.css';
import { MoneyInput } from '@/app/calculadora/MoneyInput';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calculator, Check, Copy, Download, Home, Layers, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  computeFlowBuckets,
  percentageForInstallment,
  roundFlowPercentage,
  formatFlowPercentage,
  DEFAULT_FLOW_PAYMENT,
  sumFlowPercentages,
  type FlowPaymentState,
} from '@/lib/flowPaymentCalculations';
import { generateFlowPaymentPDF } from '@/services/flowPaymentPdf';

const FLOW_SECTIONS = [
  { key: 'entrada' as const, label: 'Entrada' },
  { key: 'mensais' as const, label: 'Mensais' },
  { key: 'intercaladas' as const, label: 'Intercaladas' },
  { key: 'chaves' as const, label: 'Chaves' },
];

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

type PhaseKey = (typeof FLOW_SECTIONS)[number]['key'];

function FlowPhaseCard({
  title,
  pct,
  onPctChange,
  parcelas,
  onParcelasChange,
  valorParcela,
  onValorParcelaChange,
  valorTotalOk,
  totalPercent,
  maxPermitido,
}: {
  title: string;
  pct: number;
  onPctChange: (n: number) => void;
  parcelas: number;
  onParcelasChange: (n: number) => void;
  valorParcela: number;
  onValorParcelaChange: (n: number) => void;
  valorTotalOk: boolean;
  totalPercent: number;
  maxPermitido: number;
}) {
  const excedeu = totalPercent > 100;
  const falta = totalPercent < 100;
  const sliderMax = Math.max(100, pct);
  const fillPct = `${pct / sliderMax * 100}%`;
  return (
    <div className="flow-card flow-card-hover flex h-full min-h-0 flex-col items-center rounded-3xl p-5 sm:p-6">
      <div className="relative z-10 flex w-full max-w-md flex-col justify-center gap-4">
        <div className="flex w-full items-center justify-between gap-4">
          <h3 className="min-w-0 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">{title}</h3>
          <span className="shrink-0 text-lg font-bold tabular-nums text-foreground">{formatFlowPercentage(pct)}%</span>
        </div>
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={Math.ceil(sliderMax)}
            step={1}
            value={pct}
            disabled={!valorTotalOk}
            onChange={(e) => onPctChange(Math.round(Number(e.target.value)))}
            style={{ '--lc-flow-fill': fillPct } as CSSProperties}
            className={`lc-flow-slider h-2 w-full appearance-none rounded-full ${
              valorTotalOk ? 'cursor-pointer' : 'cursor-not-allowed opacity-[0.45]'
            }`}
            aria-label={`Percentagem ${title} sobre o valor total do imóvel`}
            aria-valuemin={0}
            aria-valuemax={Math.ceil(sliderMax)}
            aria-valuenow={pct}
            aria-disabled={!valorTotalOk}
          />
          {!valorTotalOk ? (
            <p className="text-[10px] leading-snug text-muted-foreground">
              Informe o valor total do imóvel na coluna à esquerda para o slider incidir sobre esse montante.
            </p>
          ) : null}
          {valorTotalOk && excedeu && pct > maxPermitido && (
            <p className="text-xs text-destructive">
              ⚠️ Defina no máximo <strong>{formatFlowPercentage(maxPermitido)}%</strong> neste campo para totalizar 100%
            </p>
          )}
          {valorTotalOk && falta && maxPermitido > pct && (
            <p className="text-xs text-yellow-400">
              💡 Defina no mínimo <strong>{formatFlowPercentage(maxPermitido)}%</strong> neste campo para totalizar 100%
            </p>
          )}
          {valorTotalOk && totalPercent !== 100 && pct !== maxPermitido && (
            <Button type="button" variant="primary" className={styles.defineButton} size="sm" onClick={() => onPctChange(maxPermitido)} aria-label={`Definir ${title} em ${formatFlowPercentage(maxPermitido)}%`}>
              Definir em {formatFlowPercentage(maxPermitido)}%
            </Button>
          )}
        </div>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
          <div className="flex w-full flex-col space-y-2">
            <label htmlFor={`flow-parcelas-${title}`} className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Parcelas</label>
            <input
              type="number"
              min={1}
              id={`flow-parcelas-${title}`}
              step={1}
              className="flow-input w-full"
              value={parcelas}
              onChange={(e) => onParcelasChange(Math.max(1, Math.trunc(Number(e.target.value)) || 1))}
            />
          </div>
          <div className="flex w-full flex-col space-y-2">
            <label htmlFor={`flow-valor-${title}`} className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor por parcela</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <MoneyInput
                id={`flow-valor-${title}`}
                disabled={!valorTotalOk}
                className="flow-input w-full pl-10 text-right font-bold tabular-nums disabled:opacity-[0.45]"
                value={valorTotalOk ? valorParcela : 0}
                onChange={onValorParcelaChange}
              />
            </div>
            {valorTotalOk ? (
              <p className="text-[10px] leading-snug text-muted-foreground">
                {parcelas} parcela{parcelas !== 1 ? 's' : ''} × este valor cobre o montante da fase.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const Calculadora = ({ publicMode = false }: { publicMode?: boolean }) => {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [unit, setUnit] = useState('');
  const [clientName, setClientName] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [creci, setCreci] = useState('');
  const [valorTotal, setValorTotal] = useState(0);
  const [flow, setFlow] = useState<FlowPaymentState>(() => ({ ...DEFAULT_FLOW_PAYMENT }));
  const [flowConfirmed, setFlowConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  const [scrollRequest, setScrollRequest] = useState(0);
  useEffect(() => {
    if (!scrollRequest) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    resultRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [scrollRequest]);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { clearTimeout(copyTimer.current); }, []);
  useEffect(() => { setCopied(false); clearTimeout(copyTimer.current); }, [projectName, unit, clientName, brokerName, creci, valorTotal, flow]);

  const valorTotalOk = Number.isFinite(valorTotal) && valorTotal > 0;

  const buckets = useMemo(() => {
    if (!valorTotalOk) return null;
    return computeFlowBuckets(Number(valorTotal), flow);
  }, [valorTotal, flow, valorTotalOk]);

  const pctConsolidado = useMemo(() => sumFlowPercentages(flow), [flow]);


  const setPct = (key: keyof FlowPaymentState, value: number) => {
    setFlow((prev) => ({ ...prev, [key]: value }));
    setFlowConfirmed(false);
  };

  const setParcelas = (key: keyof FlowPaymentState, value: number) => {
    setFlow((prev) => ({ ...prev, [key]: value }));
    setFlowConfirmed(false);
  };

  const handleGerarFluxo = (e: FormEvent) => {
    e.preventDefault();
    const name = projectName.trim();
    if (!name) {
      toast.error('Indique o nome do empreendimento.');
      return;
    }
    if (!valorTotalOk) {
      toast.error('Indique o valor total do imóvel.');
      return;
    }
    setFlowConfirmed(true);
    setScrollRequest((request) => request + 1);
  };

  const buildFluxoText = () => {
    if (!buckets) return '';
    let text = `*${projectName.trim()}*\n`;
    if (clientName.trim()) text += `Cliente: ${clientName.trim()}\n`;
    if (unit.trim()) text += `Unidade: ${unit.trim()}\n`;
    text += `Valor total: ${formatCurrency(Number(valorTotal))}\n\n`;
    text += `*Fluxo de pagamento*\n\n`;
    const rows: { label: string; b: (typeof buckets)['entrada'] }[] = [
      { label: 'Entrada', b: buckets.entrada },
      { label: 'Mensais', b: buckets.mensais },
      { label: 'Intercaladas', b: buckets.intercaladas },
      { label: 'Chaves', b: buckets.chaves },
    ];
    rows.forEach(({ label, b }) => {
      if (b.pct <= 0) return;
      text += `- *${label}*: ${formatFlowPercentage(b.pct)}%\n`;
      text += `  ${formatCurrency(b.totalFase)}`;
      if (b.parcelas > 1) text += ` em ${b.parcelas}x de ${formatCurrency(b.valorParcela)}`;
      else text += ` (${formatCurrency(b.valorParcela)})`;
      text += `\n\n`;
    });
    if (brokerName.trim()) text += `Corretor: ${brokerName.trim()}\n`;
    if (creci.trim()) text += `CRECI: ${creci.trim()}\n`;
    return text;
  };

  const copiar = async () => {
    if (!flowConfirmed || !buckets) return;
    const text = buildFluxoText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Fluxo copiado!');
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar o fluxo. Tente novamente ou use o WhatsApp.');
    }
  };

  const handleExportPDF = async () => {
    if (!flowConfirmed || !buckets) {
      toast.error('Gere o fluxo de pagamento antes de exportar.');
      return;
    }
    const name = projectName.trim();
    if (!name) {
      toast.error('Indique o nome do empreendimento.');
      return;
    }
    try {
      toast.loading('Gerando PDF...', { id: 'pdf' });
      const rows = [
        {
          label: 'Entrada',
          pct: flow.pctEntrada,
          parcelas: flow.parcelasEntrada,
          totalFase: buckets.entrada.totalFase,
          valorParcela: buckets.entrada.valorParcela,
        },
        {
          label: 'Mensais',
          pct: flow.pctMensais,
          parcelas: flow.parcelasMensais,
          totalFase: buckets.mensais.totalFase,
          valorParcela: buckets.mensais.valorParcela,
        },
        {
          label: 'Intercaladas',
          pct: flow.pctIntercaladas,
          parcelas: flow.parcelasIntercaladas,
          totalFase: buckets.intercaladas.totalFase,
          valorParcela: buckets.intercaladas.valorParcela,
        },
        {
          label: 'Chaves',
          pct: flow.pctChaves,
          parcelas: flow.parcelasChaves,
          totalFase: buckets.chaves.totalFase,
          valorParcela: buckets.chaves.valorParcela,
        },
      ];
      await generateFlowPaymentPDF({
        projectName: name,
        clientName: clientName.trim(),
        brokerName: brokerName.trim(),
        creci: creci.trim(),
        unit,
        valorTotal: Number(valorTotal),
        rows,
      });
      toast.success('PDF exportado.', { id: 'pdf' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro ao gerar PDF: ' + msg, { id: 'pdf' });
    }
  };

  const phaseProps: Record<
    PhaseKey,
    {
      pct: number;
      onPctChange: (n: number) => void;
      parcelas: number;
      onParcelasChange: (n: number) => void;
      valorParcela: number;
    }
  > = {
    entrada: {
      pct: flow.pctEntrada,
      onPctChange: (n) => setPct('pctEntrada', n),
      parcelas: flow.parcelasEntrada,
      onParcelasChange: (n) => setParcelas('parcelasEntrada', n),
      valorParcela: buckets?.entrada.valorParcela ?? 0,
    },
    mensais: {
      pct: flow.pctMensais,
      onPctChange: (n) => setPct('pctMensais', n),
      parcelas: flow.parcelasMensais,
      onParcelasChange: (n) => setParcelas('parcelasMensais', n),
      valorParcela: buckets?.mensais.valorParcela ?? 0,
    },
    intercaladas: {
      pct: flow.pctIntercaladas,
      onPctChange: (n) => setPct('pctIntercaladas', n),
      parcelas: flow.parcelasIntercaladas,
      onParcelasChange: (n) => setParcelas('parcelasIntercaladas', n),
      valorParcela: buckets?.intercaladas.valorParcela ?? 0,
    },
    chaves: {
      pct: flow.pctChaves,
      onPctChange: (n) => setPct('pctChaves', n),
      parcelas: flow.parcelasChaves,
      onParcelasChange: (n) => setParcelas('parcelasChaves', n),
      valorParcela: buckets?.chaves.valorParcela ?? 0,
    },
  };

  return (
    <div className={`${styles.calculator} relative flex min-h-screen flex-col overflow-hidden`}>
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-28 pt-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex animate-fade-in items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {!publicMode && <button
              type="button"
              onClick={() => router.push('/')}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Voltar ao início"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>}
            <h1 className="gradient-silver text-2xl font-normal uppercase tracking-wider">Calculadora de fluxo</h1>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden gap-2 rounded-md md:inline-flex"
            disabled={!flowConfirmed || !buckets}
            onClick={handleExportPDF}
            title="Exportar PDF"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </header>

        <div className="mb-4 flex items-center gap-2 text-muted-foreground">
          <Layers className="h-5 w-5 shrink-0 text-foreground/80" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-[0.12em]">Simulação de obra / lançamento</p>
        </div>

        <form
          noValidate
          onSubmit={handleGerarFluxo}
          className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:items-stretch lg:gap-x-8 lg:gap-y-6"
        >
          <div className="space-y-4 lg:col-span-4 lg:row-start-1 lg:self-start">
            <div className="space-y-4 lg:sticky lg:top-24 lg:space-y-4">
              <div className="flow-card space-y-4 rounded-3xl p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                  <Home className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                  Dados do imóvel
                </h2>
                <div className="space-y-2">
                  <label htmlFor="flow-project" className="text-sm font-medium text-muted-foreground">Nome do empreendimento *</label>
                  <input
                    type="text"
                    required
                    className="flow-input w-full"
                    id="flow-project"
                    placeholder="Nome do empreendimento *"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value);
                      setFlowConfirmed(false);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="flow-unit" className="text-sm font-medium text-muted-foreground">Unidade</label>
                  <input
                    type="text"
                    className="flow-input w-full"
                    id="flow-unit"
                    placeholder="Unidade"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="flow-total" className="text-sm font-medium text-muted-foreground">Valor total do imóvel</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                    <MoneyInput
                      id="flow-total"
                      className="flow-input w-full pl-12"
                      value={valorTotal}
                      onChange={(value) => {
                        setValorTotal(value);
                        setFlowConfirmed(false);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flow-card space-y-4 p-5 sm:p-6">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em]">Dados da simulação</h2>
                {[
                  { id: 'flow-client', label: 'Nome do cliente', value: clientName, set: setClientName },
                  { id: 'flow-broker', label: 'Nome do corretor', value: brokerName, set: setBrokerName },
                  { id: 'flow-creci', label: 'CRECI', value: creci, set: setCreci },
                ].map(({ id, label, value, set }) => (
                  <div key={id} className="space-y-2">
                    <label htmlFor={id} className="text-sm font-medium text-muted-foreground">{label}</label>
                    <input id={id} type="text" className="flow-input w-full" placeholder={label} value={value} onChange={(e) => { set(e.target.value); setFlowConfirmed(false); }} />
                  </div>
                ))}
              </div>

              <div className="flow-card space-y-3 rounded-2xl px-4 py-3 text-sm text-muted-foreground" role="note">
                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  O <strong className="font-semibold text-foreground">% do slider</strong> incide sobre o{' '}
                  <strong className="font-semibold text-foreground">valor total do imóvel</strong>. O{' '}
                  <strong className="font-semibold text-foreground">valor por parcela</strong> = montante da fase ÷
                  parcelas (atualiza em tempo real). Você também pode editar o valor da parcela para recalcular o percentual da fase.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-8 lg:row-span-2 lg:row-start-1 xl:gap-6">
            {FLOW_SECTIONS.map(({ key, label }) => {
              const otherPct = FLOW_SECTIONS.reduce((s, sec) => sec.key === key ? s : s + phaseProps[sec.key].pct, 0);
              const maxPermitido = Math.max(0, roundFlowPercentage(100 - otherPct));
              return (
                <FlowPhaseCard
                  key={key}
                  title={label}
                  pct={phaseProps[key].pct}
                  onPctChange={phaseProps[key].onPctChange}
                  parcelas={phaseProps[key].parcelas}
                  onParcelasChange={phaseProps[key].onParcelasChange}
                  valorParcela={phaseProps[key].valorParcela}
                  valorTotalOk={valorTotalOk}
                  onValorParcelaChange={(value) => phaseProps[key].onPctChange(percentageForInstallment(valorTotal, phaseProps[key].parcelas, value))}
                  totalPercent={pctConsolidado}
                  maxPermitido={maxPermitido}
                />
              );
            })}
          </div>

          <div className={`${styles.actions} lg:col-span-4 lg:row-start-2 lg:self-end`} role="group" aria-label="Ações do fluxo">
            <Button type="submit" variant="primary" className="h-12 w-full rounded-md font-bold">
              <Calculator className="mr-2 inline h-5 w-5 align-middle" aria-hidden />
              <span className="md:hidden">Gerar fluxo</span>
              <span className="hidden md:inline">Gerar fluxo de pagamento</span>
            </Button>
            <Button type="button" variant="outline" className="h-12 gap-2 md:hidden" disabled={!flowConfirmed || !buckets} onClick={handleExportPDF} aria-label="Imprimir PDF">
              <Download className="h-4 w-4" />
              Imprimir PDF
            </Button>
          </div>
        </form>

        {flowConfirmed && buckets ? (
          <section id="flow-result" ref={resultRef} className={`${styles.result} mt-8 space-y-4`} aria-label="Resumo do fluxo de pagamento">
            <div className="flow-card rounded-3xl p-4 text-sm text-muted-foreground sm:p-5 lg:p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Resumo</p>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                <li className="list-none rounded-2xl border border-border/30 bg-muted/20 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">Entrada</span>
                  <p className="mt-1 text-foreground">
                    {flow.parcelasEntrada} × {formatCurrency(buckets.entrada.valorParcela)}
                  </p>
                  <p className="mt-0.5 text-xs opacity-90">Total {formatCurrency(buckets.entrada.totalFase)}</p>
                </li>
                <li className="list-none rounded-2xl border border-border/30 bg-muted/20 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">Mensais</span>
                  <p className="mt-1 text-foreground">
                    {flow.parcelasMensais} × {formatCurrency(buckets.mensais.valorParcela)}
                  </p>
                  <p className="mt-0.5 text-xs opacity-90">Total {formatCurrency(buckets.mensais.totalFase)}</p>
                </li>
                <li className="list-none rounded-2xl border border-border/30 bg-muted/20 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">Intercaladas</span>
                  <p className="mt-1 text-foreground">
                    {flow.parcelasIntercaladas} × {formatCurrency(buckets.intercaladas.valorParcela)}
                  </p>
                  <p className="mt-0.5 text-xs opacity-90">Total {formatCurrency(buckets.intercaladas.totalFase)}</p>
                </li>
                <li className="list-none rounded-2xl border border-border/30 bg-muted/20 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">Chaves</span>
                  <p className="mt-1 text-foreground">
                    {flow.parcelasChaves} × {formatCurrency(buckets.chaves.valorParcela)}
                  </p>
                  <p className="mt-0.5 text-xs opacity-90">Total {formatCurrency(buckets.chaves.totalFase)}</p>
                </li>
              </ul>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                className={styles.whatsappButton}
                href={`https://wa.me/?text=${encodeURIComponent(buildFluxoText())}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Enviar no WhatsApp
              </a>
              <Button variant="outline" className="h-12 w-full gap-2 rounded-lg" type="button" onClick={copiar}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado!' : 'Copiar fluxo'}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default Calculadora;
