"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { addMonths, eachDayOfInterval, eachMonthOfInterval, format, parseISO, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileInput,
  HandCoins,
  Link2,
  Megaphone,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { MarketingEmptyState, MarketingSkeleton } from "@/components/marketing/MarketingUI";
import { VgvCommercialReportGenerator } from "@/components/marketing/VgvCommercialReportGenerator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { FinancialPrivacyButton } from "@/components/ui/FinancialPrivacyButton";
import { getMarketingVgvPeriodRange, type MarketingVgvPeriodMode } from "@/lib/marketing/vgv-period";
import { calculateCampaignRows, calculateSaleCommissions, calculateVgvCustomMetrics, calculateVgvIntelligence, relateCampaignPerformanceToSales } from "@/lib/marketing/vgv-intelligence";
import { privateFinancialValue, useFinancialPrivacyStore } from "@/store/financial-privacy";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { cn } from "@/lib/utils";
import type { MarketingVgvCampaignPerformance, MarketingVgvCustomField, MarketingVgvForm, MarketingVgvSale, MarketingVgvSaleInput } from "@/types/marketing";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatCurrency = (value: number) => privateFinancialValue(currency.format(value));
const formatCompactCurrency = (value: number) => privateFinancialValue(compactCurrency.format(value));
const tooltipStyle = {
  background: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: 12,
  color: "var(--chart-tooltip-text)",
  boxShadow: "0 14px 38px rgba(0,0,0,.24)",
};
const axisTick = { fill: "var(--text-body)", fontSize: 11 };
const normalizeCampaignName = (value: string | null | undefined) => String(value ?? "").trim().toLocaleLowerCase("pt-BR");

const PERIOD_OPTIONS: { value: MarketingVgvPeriodMode; label: string }[] = [
  { value: "month", label: "Mês" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
  { value: "year", label: "Outro Ano" },
];

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível concluir a operação");
  return body;
}

export default function MarketingVgvPage() {
  return <MarketingVgvModule />;
}

export function MarketingVgvModule({ embedded = false }: { embedded?: boolean }) {
  const { assignableClients } = useAgencyClients();
  const valuesHidden = useFinancialPrivacyStore((state) => state.valuesHidden);
  void valuesHidden;
  const [period, setPeriod] = useState(startOfMonth(new Date()));
  const [periodMode, setPeriodMode] = useState<MarketingVgvPeriodMode>("month");
  const [sales, setSales] = useState<MarketingVgvSale[]>([]);
  const [performance, setPerformance] = useState<MarketingVgvCampaignPerformance[]>([]);
  const [registeredCampaigns, setRegisteredCampaigns] = useState<MarketingVgvCampaignPerformance[]>([]);
  const [forms, setForms] = useState<MarketingVgvForm[]>([]);
  const [activeView, setActiveView] = useState<"overview" | "sales" | "campaigns" | "forms">("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<MarketingVgvSale | null>(null);
  const [editingPerformance, setEditingPerformance] = useState<MarketingVgvCampaignPerformance | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("all");
  const [selectedCampaignName, setSelectedCampaignName] = useState("all");
  const [performanceDialogOpen, setPerformanceDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const range = useMemo(() => getMarketingVgvPeriodRange(periodMode, period), [period, periodMode]);
  const rangeStart = format(range.start, "yyyy-MM-dd");
  const rangeEnd = format(range.end, "yyyy-MM-dd");
  const periodSelectorLabel = useMemo(() => {
    if (periodMode === "month") return format(period, "MMMM", { locale: ptBR });
    if (periodMode === "year") return format(period, "yyyy");
    return `${format(range.start, "MMM/yy", { locale: ptBR })} — ${format(addMonths(range.end, -1), "MMM/yy", { locale: ptBR })}`;
  }, [period, periodMode, range.end, range.start]);
  const reportUntil = format(subDays(range.end, 1), "yyyy-MM-dd");

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ start: rangeStart, end: rangeEnd });
      const [salesData, performanceData, registeredCampaignData, formsData] = await Promise.all([
        request<{ sales: MarketingVgvSale[] }>(`/api/marketing/vgv?${params}`),
        request<{ performance: MarketingVgvCampaignPerformance[] }>(`/api/marketing/vgv/performance?${params}`),
        request<{ performance: MarketingVgvCampaignPerformance[] }>("/api/marketing/vgv/performance?all=true"),
        request<{ forms: MarketingVgvForm[] }>("/api/marketing/vgv/forms"),
      ]);
      setSales(salesData.sales);
      setPerformance(performanceData.performance);
      setRegisteredCampaigns(registeredCampaignData.performance);
      setForms(formsData.forms);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar as vendas");
    } finally {
      setIsLoading(false);
    }
  }, [rangeEnd, rangeStart]);

  useEffect(() => { void loadSales(); }, [loadSales]);

  const registeredCampaignOptions = useMemo(() => {
    const rows = selectedClientId === "all" ? registeredCampaigns : registeredCampaigns.filter((row) => row.agency_client_id === selectedClientId);
    const names = new Map<string, string>();
    rows.forEach((row) => names.set(normalizeCampaignName(row.campaign_name), row.campaign_name));
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [registeredCampaigns, selectedClientId]);
  useEffect(() => { setSelectedCampaignName("all"); }, [selectedClientId]);

  const analysisSales = useMemo(() => sales.filter((sale) => (selectedClientId === "all" || sale.agency_client_id === selectedClientId) && (selectedCampaignName === "all" || normalizeCampaignName(sale.campaign_name) === normalizeCampaignName(selectedCampaignName))), [sales, selectedCampaignName, selectedClientId]);
  const analysisPerformance = useMemo(() => {
    const clientManual = selectedClientId === "all" ? registeredCampaigns : registeredCampaigns.filter((row) => row.agency_client_id === selectedClientId);
    if (selectedCampaignName !== "all") {
      return clientManual.filter((row) => normalizeCampaignName(row.campaign_name) === normalizeCampaignName(selectedCampaignName));
    }
    return relateCampaignPerformanceToSales(clientManual, performance, analysisSales);
  }, [analysisSales, performance, registeredCampaigns, selectedCampaignName, selectedClientId]);
  const metrics = useMemo(() => calculateVgvIntelligence(analysisSales, analysisPerformance), [analysisPerformance, analysisSales]);
  const campaignRows = useMemo(() => calculateCampaignRows(analysisSales, analysisPerformance), [analysisPerformance, analysisSales]);
  const customMetrics = useMemo(() => calculateVgvCustomMetrics(forms, analysisSales), [analysisSales, forms]);

  const evolutionData = useMemo(() => {
    const totals = new Map<string, number>();
    if (periodMode === "month") {
      for (const sale of analysisSales) totals.set(sale.sale_date, (totals.get(sale.sale_date) ?? 0) + sale.sale_value);
      return eachDayOfInterval({ start: range.start, end: subDays(range.end, 1) }).map((day) => {
        const key = format(day, "yyyy-MM-dd");
        return { date: format(day, "dd"), value: totals.get(key) ?? 0 };
      });
    }

    for (const sale of analysisSales) {
      const key = sale.sale_date.slice(0, 7);
      totals.set(key, (totals.get(key) ?? 0) + sale.sale_value);
    }
    return eachMonthOfInterval({ start: range.start, end: addMonths(range.end, -1) }).map((date) => {
      const key = format(date, "yyyy-MM");
      return {
        date: format(date, periodMode === "year" ? "MMM" : "MMM/yy", { locale: ptBR }),
        value: totals.get(key) ?? 0,
      };
    });
  }, [analysisSales, periodMode, range.end, range.start]);

  const brokerData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const sale of analysisSales) totals.set(sale.broker_name, (totals.get(sale.broker_name) ?? 0) + sale.sale_value);
    return Array.from(totals, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [analysisSales]);

  async function deleteSale(sale: MarketingVgvSale) {
    if (!window.confirm(`Apagar a venda atribuída a ${sale.client_name}?`)) return;
    try {
      await request(`/api/marketing/vgv/${sale.id}`, { method: "DELETE" });
      setSales((items) => items.filter((item) => item.id !== sale.id));
      toast.success("Venda apagada");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Erro ao apagar a venda");
    }
  }

  async function deleteCampaign(campaign: MarketingVgvCampaignPerformance) {
    if (!window.confirm(`Excluir a campanha "${campaign.campaign_name}"? As vendas já registradas serão preservadas, mas este investimento e os leads deixarão de entrar nas métricas.`)) return;
    try {
      await request(`/api/marketing/vgv/performance/${campaign.id}`, { method: "DELETE" });
      setPerformance((items) => items.filter((item) => item.id !== campaign.id));
      setRegisteredCampaigns((items) => items.filter((item) => item.id !== campaign.id));
      if (selectedCampaignName !== "all" && normalizeCampaignName(selectedCampaignName) === normalizeCampaignName(campaign.campaign_name)) setSelectedCampaignName("all");
      toast.success("Campanha excluída");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Erro ao excluir a campanha");
    }
  }

  const navigatePeriod = (direction: -1 | 1) => {
    const step = periodMode === "year"
      ? 12
      : periodMode === "month"
        ? 1
        : Number.parseInt(periodMode, 10);
    setPeriod((date) => addMonths(date, direction * step));
  };

  return (
    <div className="pb-10">
      {!embedded && <Header
        title="VGV"
        subtitle="Vendas atribuídas ao trabalho de marketing"
        actions={<div className="flex items-center gap-2"><FinancialPrivacyButton compact /><VgvCommercialReportGenerator clients={assignableClients} selectedClientId={selectedClientId} since={rangeStart} until={reportUntil} sales={sales} performance={performance} registeredCampaigns={registeredCampaigns} /><Button onClick={() => setDialogOpen(true)} icon={<Plus size={15} />} signature size="medium">Registrar venda</Button></div>}
      />}

      <div className={embedded ? "" : "px-4 sm:px-6"}>
        {embedded && <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--primary)]">Performance comercial</p><h2 className="mt-1 text-lg font-semibold text-[var(--text-title)]">VGV atribuído ao marketing</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Vendas, ticket e comissão consolidados no período.</p></div><div className="flex items-center gap-2"><VgvCommercialReportGenerator clients={assignableClients} selectedClientId={selectedClientId} since={rangeStart} until={reportUntil} sales={sales} performance={performance} registeredCampaigns={registeredCampaigns} /><Button onClick={() => setDialogOpen(true)} icon={<Plus size={15} />} signature size="medium">Registrar venda</Button></div></div>}
        <nav className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-2xl border p-1.5" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
          {([
            ["overview", "Visão geral", <TrendingUp key="i" size={14} />],
            ["sales", "Vendas", <ReceiptText key="i" size={14} />],
            ["campaigns", "Campanhas", <Megaphone key="i" size={14} />],
            ["forms", "Formulários", <FileInput key="i" size={14} />],
          ] as const).map(([id, label, icon]) => <button key={id} onClick={() => setActiveView(id)} className={cn("flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition", activeView === id ? "bg-[var(--segment-active-bg)] text-[var(--text-title)]" : "text-[var(--muted-foreground)] hover:text-[var(--text-title)]")}>{icon}{label}</button>)}
        </nav>
        {activeView !== "forms" && <div className="mb-5 flex flex-col gap-3">
          <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border p-1" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}>
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriodMode(option.value)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                style={periodMode === option.value
                  ? { background: "rgba(39,163,255,.18)", color: "#27a3ff", boxShadow: "inset 0 1px 0 rgba(39,163,255,.18)" }
                  : { color: "var(--muted-foreground)" }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label={periodMode === "year" ? "Ano anterior" : "Período anterior"}
              onClick={() => navigatePeriod(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--icon)] transition-all hover:bg-[var(--hover)] hover:text-[var(--text-title)] active:scale-90"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="lc-card flex min-w-[160px] items-center justify-center px-4 py-2">
              <p className="text-sm font-semibold capitalize text-[var(--text-title)]">{periodSelectorLabel}</p>
            </div>
            <button
              aria-label={periodMode === "year" ? "Próximo ano" : "Próximo período"}
              onClick={() => navigatePeriod(1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--icon)] transition-all hover:bg-[var(--hover)] hover:text-[var(--text-title)] active:scale-90"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <section className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
            <Field label="Visão por cliente" id="vgv-client-filter">
              <select id="vgv-client-filter" value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="lc-form-control crm-form-select"><option value="all">Todos os clientes</option>{assignableClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
            </Field>
            <Field label="Campanhas cadastradas" id="vgv-campaign-filter">
              <select id="vgv-campaign-filter" value={selectedCampaignName} onChange={(event) => setSelectedCampaignName(event.target.value)} disabled={!registeredCampaignOptions.length} className="lc-form-control crm-form-select"><option value="all">Todas as campanhas do cliente</option>{registeredCampaignOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select>
            </Field>
            <p className="text-[11px] leading-5 text-[var(--muted-foreground)] sm:col-span-2">{selectedCampaignName !== "all" ? "Visão da campanha selecionada com investimento, leads e período cadastrados manualmente." : selectedClientId !== "all" ? "Visão geral do cliente cruzando as vendas com as campanhas cadastradas manualmente no período." : "Visão consolidada com os dados cadastrados manualmente no período."}</p>
          </section>
        </div>}

        {isLoading ? <MarketingSkeleton /> : error ? (
          <MarketingEmptyState title="Não foi possível carregar o VGV" description={error} action={<Button onClick={() => void loadSales()} variant="outline">Tentar novamente</Button>} />
        ) : (
          <>
            {activeView === "overview" && <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard label={periodMode === "month" ? "VGV no mês" : "VGV no período"} value={formatCurrency(metrics.totalVgv)} icon={<TrendingUp />} accent="#27a3ff" />
              <MetricCard label="Vendas registradas" value={metrics.count.toLocaleString("pt-BR")} icon={<ReceiptText />} accent="#27f2e6" />
              <MetricCard label="Ticket médio" value={formatCurrency(metrics.averageTicket)} icon={<CircleDollarSign />} accent="#a78bfa" />
              <MetricCard label="Comissão comercial gerada" value={formatCurrency(metrics.grossCommission)} icon={<HandCoins />} accent="#14b8a6" />
              <MetricCard label="Comissão Genesy" value={formatCurrency(metrics.agencyCommission)} icon={<HandCoins />} accent="#22c55e" />
              <MetricCard label="Investimento em mídia" value={formatCurrency(metrics.spend)} icon={<Megaphone />} accent="#f59e0b" />
              <MetricCard label="CPL" value={metrics.leads ? formatCurrency(metrics.cpl) : "—"} icon={<UsersRound />} accent="#38bdf8" />
              <MetricCard label="CAC" value={metrics.count && metrics.spend ? formatCurrency(metrics.cac) : "—"} icon={<CircleDollarSign />} accent="#fb7185" />
              <MetricCard label="Conversão lead → venda" value={metrics.leads ? `${metrics.conversionRate.toFixed(2)}%` : "—"} icon={<ClipboardCheck />} accent="#34d399" />
              <MetricCard label="ROAS sobre VGC" value={metrics.spend ? `${metrics.commercialRoas.toFixed(1)}x` : "—"} description={metrics.spend ? `A cada R$ 1 investido, voltaram ${currency.format(metrics.commercialRoas)} em comissão.` : undefined} icon={<TrendingUp />} accent="#22c55e" />
            </div>

            {customMetrics.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">{customMetrics.map((metric) => <MetricCard key={metric.id} label={`${metric.label} · total`} value={metric.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} icon={<ClipboardCheck />} accent="#818cf8" />)}</div>}

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <ChartCard title="Evolução do VGV" description={periodMode === "month" ? "Volume vendido por dia no mês selecionado" : "Volume vendido por mês no período selecionado"}>
                <ResponsiveContainer width="100%" height={270}>
                  <AreaChart data={evolutionData} margin={{ top: 12, right: 8, left: -2, bottom: 2 }}>
                    <defs>
                      <linearGradient id="vgv-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#27a3ff" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#27a3ff" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 6" vertical={false} />
                    <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} interval={periodMode === "month" ? 4 : 0} />
                    <YAxis tick={axisTick} tickFormatter={(value) => formatCompactCurrency(Number(value))} tickLine={false} axisLine={false} width={76} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value)), "VGV"]} labelFormatter={(label) => periodMode === "month" ? `Dia ${label}` : String(label)} />
                    <Area type="monotone" dataKey="value" stroke="#27a3ff" strokeWidth={3} fill="url(#vgv-area)" activeDot={{ r: 5, fill: "#27a3ff", stroke: "var(--text-title)", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="VGV por corretor" description="Corretores com maior volume no período">
                {brokerData.length ? (
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart data={brokerData} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 2 }}>
                      <defs>
                        <linearGradient id="vgv-broker-bar" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#27a3ff" stopOpacity={0.7} />
                          <stop offset="100%" stopColor="#27f2e6" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 6" horizontal={false} />
                      <XAxis type="number" tick={axisTick} tickFormatter={(value) => formatCompactCurrency(Number(value))} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={94} tick={axisTick} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value)), "VGV"]} />
                      <Bar dataKey="value" fill="url(#vgv-broker-bar)" radius={[3, 9, 9, 3]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="flex h-[270px] items-center justify-center text-sm text-[var(--muted-foreground)]">Registre uma venda para visualizar o ranking.</div>}
              </ChartCard>
            </div>
            </>}

            {(activeView === "overview" || activeView === "sales") && <section className="mt-5 overflow-hidden rounded-2xl border" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
              <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h2 className="text-sm font-semibold">Vendas registradas</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">{metrics.count} {metrics.count === 1 ? "registro no período" : "registros no período"}</p>
                </div>
                <UsersRound size={18} className="text-[var(--muted-foreground)]" />
              </div>
              {analysisSales.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                      <tr>
                        <th className="px-5 py-3 font-medium">Corretor</th>
                        <th className="px-5 py-3 font-medium">Comprador</th>
                        <th className="px-5 py-3 font-medium">Data</th>
                        <th className="px-5 py-3 font-medium">Campanha</th>
                        <th className="px-5 py-3 text-right font-medium">Valor da venda</th>
                        <th className="px-5 py-3 text-right font-medium">Comissão comercial</th>
                        <th className="px-5 py-3 text-right font-medium">Comissão Genesy</th>
                        <th className="w-14 px-3 py-3"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisSales.map((sale) => (
                        <tr key={sale.id} className="border-t transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)" }}>
                          <td className="px-5 py-3.5 font-medium">{sale.broker_name}</td>
                          <td className="px-5 py-3.5 text-[var(--text-body)]">{sale.buyer_name || sale.client_name}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs text-[var(--muted-foreground)]">{format(parseISO(sale.sale_date), "dd/MM/yyyy")}</td>
                          <td className="max-w-[220px] truncate px-5 py-3.5 text-xs text-[var(--text-body)]">{sale.campaign_name || "—"}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold">{formatCurrency(sale.sale_value)}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right"><span className="block font-medium">{formatCurrency(calculateSaleCommissions(sale).grossCommission)}</span><span className="text-[10px] text-[var(--muted-foreground)]">{sale.commission_percentage.toLocaleString("pt-BR")}% do VGV</span></td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <span className="block text-xs text-[var(--muted-foreground)]">{sale.include_agency_commission ? formatCurrency(calculateSaleCommissions(sale).genesyCommission) : "Não incluída"}</span>
                            {sale.include_agency_commission && <span className="text-[10px] text-[var(--muted-foreground)]">{sale.agency_share_percentage.toLocaleString("pt-BR")}% da comissão</span>}
                          </td>
                          <td className="px-3 py-3.5 text-right"><div className="flex justify-end gap-1">
                            {sale.can_edit && (
                              <button
                                aria-label={`Editar venda de ${sale.client_name}`}
                                onClick={() => { setEditingSale(sale); setDialogOpen(true); }}
                                className="rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-title)]"
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                            {sale.can_delete && (
                              <button
                                aria-label={`Apagar venda de ${sale.client_name}`}
                                onClick={() => void deleteSale(sale)}
                                className="rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-5">
                  <MarketingEmptyState title="Nenhuma venda neste período" description="Registre a primeira venda atribuída ao seu trabalho de marketing." action={<Button onClick={() => setDialogOpen(true)} icon={<Plus />}>Registrar venda</Button>} />
                </div>
              )}
            </section>}
            {activeView === "campaigns" && <CampaignPerformanceSection rows={campaignRows} rawRows={registeredCampaigns.filter((row) => (selectedClientId === "all" || row.agency_client_id === selectedClientId) && (selectedCampaignName === "all" || normalizeCampaignName(row.campaign_name) === normalizeCampaignName(selectedCampaignName)))} onAdd={() => { setEditingPerformance(null); setPerformanceDialogOpen(true); }} onEdit={(row) => { setEditingPerformance(row); setPerformanceDialogOpen(true); }} onDelete={deleteCampaign} />}
            {activeView === "forms" && <VgvFormsSection forms={forms} onCreate={() => setFormDialogOpen(true)} onToggle={async (form) => { try { const status = form.status === "active" ? "paused" : "active"; await request(`/api/marketing/vgv/forms/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); setForms((items) => items.map((item) => item.id === form.id ? { ...item, status } : item)); toast.success(status === "active" ? "Formulário ativado" : "Formulário pausado"); } catch (toggleError) { toast.error(toggleError instanceof Error ? toggleError.message : "Erro ao alterar o formulário"); } }} />}
          </>
        )}
      </div>

      <SaleDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => { setDialogOpen(nextOpen); if (!nextOpen) setEditingSale(null); }}
        sale={editingSale}
        defaultDate={format(new Date(), "yyyy-MM-dd") >= rangeStart && format(new Date(), "yyyy-MM-dd") < rangeEnd ? format(new Date(), "yyyy-MM-dd") : rangeStart}
        onCreated={(sale) => {
          if (sale.sale_date >= rangeStart && sale.sale_date < rangeEnd) setSales((items) => [sale, ...items]);
        }}
        onUpdated={(sale) => setSales((items) => sale.sale_date >= rangeStart && sale.sale_date < rangeEnd ? items.map((item) => item.id === sale.id ? sale : item) : items.filter((item) => item.id !== sale.id))}
        clients={assignableClients}
        campaigns={registeredCampaigns}
      />
      <PerformanceDialog open={performanceDialogOpen} onOpenChange={(nextOpen) => { setPerformanceDialogOpen(nextOpen); if (!nextOpen) setEditingPerformance(null); }} clients={assignableClients} defaultStart={rangeStart} defaultEnd={format(subDays(range.end, 1), "yyyy-MM-dd")} row={editingPerformance} onCreated={(row) => { setRegisteredCampaigns((items) => [row, ...items]); if (row.period_start < rangeEnd && row.period_end >= rangeStart) setPerformance((items) => [row, ...items]); }} onUpdated={(row) => { setRegisteredCampaigns((items) => items.map((item) => item.id === row.id ? row : item)); setPerformance((items) => row.period_start < rangeEnd && row.period_end >= rangeStart ? (items.some((item) => item.id === row.id) ? items.map((item) => item.id === row.id ? row : item) : [row, ...items]) : items.filter((item) => item.id !== row.id)); if (editingPerformance && (editingPerformance.agency_client_id !== row.agency_client_id || editingPerformance.campaign_name !== row.campaign_name)) setSales((items) => items.map((sale) => sale.agency_client_id === editingPerformance.agency_client_id && sale.campaign_name === editingPerformance.campaign_name ? { ...sale, agency_client_id: row.agency_client_id, campaign_name: row.campaign_name } : sale)); }} />
      <VgvFormDialog open={formDialogOpen} onOpenChange={setFormDialogOpen} clients={assignableClients} onCreated={(form) => setForms((items) => [form, ...items])} />
    </div>
  );
}

function SaleDialog({ open, onOpenChange, defaultDate, onCreated, onUpdated, clients, campaigns, sale }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  onCreated: (sale: MarketingVgvSale) => void;
  onUpdated: (sale: MarketingVgvSale) => void;
  clients: Array<{ id: string; name: string }>;
  campaigns: MarketingVgvCampaignPerformance[];
  sale: MarketingVgvSale | null;
}) {
  const [form, setForm] = useState<MarketingVgvSaleInput>({
    sale_value: 0,
    broker_name: "",
    client_name: "",
    commission_percentage: 0,
    agency_client_id: null,
    buyer_name: "",
    campaign_name: "",
    development_name: "",
    include_agency_commission: true,
    agency_share_percentage: 100,
    sale_date: defaultDate,
  });
  const [isSaving, setIsSaving] = useState(false);
  const availableCampaigns = useMemo(() => {
    const options = new Map<string, MarketingVgvCampaignPerformance>();
    campaigns.filter((row) => row.agency_client_id === form.agency_client_id).forEach((row) => options.set(normalizeCampaignName(row.campaign_name), row));
    return Array.from(options.values()).sort((a, b) => a.campaign_name.localeCompare(b.campaign_name, "pt-BR"));
  }, [campaigns, form.agency_client_id]);

  useEffect(() => {
    if (open) setForm(sale ? {
      sale_value: sale.sale_value,
      broker_name: sale.broker_name,
      client_name: sale.client_name,
      commission_percentage: sale.commission_percentage,
      sale_date: sale.sale_date,
      agency_client_id: sale.agency_client_id,
      buyer_name: sale.buyer_name ?? sale.client_name,
      campaign_name: sale.campaign_name ?? "",
      development_name: sale.development_name ?? "",
      include_agency_commission: sale.include_agency_commission,
      agency_share_percentage: sale.agency_share_percentage,
      custom_answers: sale.custom_answers,
    } : { sale_value: 0, broker_name: "", client_name: "", commission_percentage: 0, sale_date: defaultDate, agency_client_id: null, buyer_name: "", campaign_name: "", development_name: "", include_agency_commission: true, agency_share_percentage: 100 });
  }, [defaultDate, open, sale]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const data = await request<{ sale: MarketingVgvSale }>(sale ? `/api/marketing/vgv/${sale.id}` : "/api/marketing/vgv", {
        method: sale ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (sale) onUpdated(data.sale); else onCreated(data.sale);
      onOpenChange(false);
      toast.success(sale ? "Venda atualizada" : "Venda registrada");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Erro ao registrar a venda");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{sale ? "Editar venda" : "Registrar venda"}</DialogTitle>
            <DialogDescription>{sale ? "Atualize os dados comerciais, campanha e percentuais desta venda." : "Adicione uma venda atribuída ao trabalho de marketing."}</DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Cliente da agência" id="vgv-agency-client" className="sm:col-span-2">
              <select id="vgv-agency-client" required value={form.agency_client_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, agency_client_id: event.target.value, campaign_name: "", development_name: "" }))} className="lc-form-control crm-form-select"><option value="">Selecionar cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
            </Field>
            <Field label="Valor da venda" id="vgv-sale-value">
              <MoneyInput value={form.sale_value} onChange={(sale_value) => setForm((current) => ({ ...current, sale_value }))} max={999_999_999.99} />
            </Field>
            <Field label="Data da venda" id="vgv-sale-date">
              <Input id="vgv-sale-date" required type="date" value={form.sale_date} onChange={(event) => setForm((current) => ({ ...current, sale_date: event.target.value }))} />
            </Field>
            <Field label="Nome do corretor" id="vgv-broker">
              <Input id="vgv-broker" required maxLength={160} placeholder="Ex.: Marina Alves" value={form.broker_name} onChange={(event) => setForm((current) => ({ ...current, broker_name: event.target.value }))} />
            </Field>
            <Field label="Lead comprador" id="vgv-client">
              <Input id="vgv-client" required maxLength={160} placeholder="Ex.: João e Ana" value={form.buyer_name ?? ""} onChange={(event) => setForm((current) => ({ ...current, buyer_name: event.target.value, client_name: event.target.value }))} />
            </Field>
            <Field label="Campanha vinculada" id="vgv-campaign">{availableCampaigns.length ? <select id="vgv-campaign" required value={form.campaign_name ?? ""} onChange={(event) => { const selected = availableCampaigns.find((row) => row.campaign_name === event.target.value); setForm((current) => ({ ...current, campaign_name: event.target.value, development_name: selected?.development_name ?? current.development_name })); }} className="lc-form-control crm-form-select"><option value="">Selecionar campanha</option>{sale?.campaign_name && !availableCampaigns.some((row) => row.campaign_name === sale.campaign_name) && <option value={sale.campaign_name}>{sale.campaign_name}</option>}{availableCampaigns.map((row) => <option key={row.id} value={row.campaign_name}>{row.campaign_name} · {formatCurrency(row.spend)} · {row.leads} leads</option>)}</select> : <Input id="vgv-campaign" required maxLength={200} placeholder={form.agency_client_id ? "Cadastre a campanha na aba Campanhas" : "Selecione primeiro o cliente"} value={form.campaign_name ?? ""} onChange={(event) => setForm((current) => ({ ...current, campaign_name: event.target.value }))} />}</Field>
            <Field label="Empreendimento" id="vgv-development"><Input id="vgv-development" required maxLength={200} value={form.development_name ?? ""} onChange={(event) => setForm((current) => ({ ...current, development_name: event.target.value }))} /></Field>
            <Field label="Comissão (%)" id="vgv-commission" className="sm:col-span-2">
              <div className="relative">
                <Input
                  id="vgv-commission"
                  required
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Ex.: 3,5"
                  value={form.commission_percentage}
                  onChange={(event) => setForm((current) => ({ ...current, commission_percentage: Number(event.target.value) }))}
                  className="pr-9"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)]">%</span>
              </div>
              {form.sale_value > 0 && (
                <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                  Comissão estimada: {formatCurrency(form.sale_value * form.commission_percentage / 100)}
                </p>
              )}
            </Field>
            <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-xs sm:col-span-2" style={{ borderColor: "var(--glass-border)" }}><span><strong className="block text-[var(--text-title)]">Incluir Comissão Genesy</strong><span className="text-[10px] text-[var(--muted-foreground)]">Calcula a parcela da Genesy sobre a comissão comercial.</span></span><input type="checkbox" checked={form.include_agency_commission ?? false} onChange={(event) => setForm((current) => ({ ...current, include_agency_commission: event.target.checked }))} /></label>
            {form.include_agency_commission && <Field label="Comissão Genesy sobre a comissão comercial (%)" id="vgv-agency-share" className="sm:col-span-2"><Input id="vgv-agency-share" type="number" min="0" max="100" step="0.01" value={form.agency_share_percentage ?? 0} onChange={(event) => setForm((current) => ({ ...current, agency_share_percentage: Number(event.target.value) }))} /></Field>}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={isSaving} loadingLabel="Salvando">{sale ? "Salvar alterações" : "Registrar venda"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CampaignPerformanceSection({ rows, rawRows, onAdd, onEdit, onDelete }: { rows: ReturnType<typeof calculateCampaignRows>; rawRows: MarketingVgvCampaignPerformance[]; onAdd: () => void; onEdit: (row: MarketingVgvCampaignPerformance) => void; onDelete: (row: MarketingVgvCampaignPerformance) => Promise<void> }) {
  return <section className="overflow-hidden rounded-2xl border" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
    <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border)" }}>
      <div><h2 className="text-sm font-semibold">Economia por campanha</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Cruza mídia, vendas e comissão comercial. O ROAS VGC mostra quantas vezes a comissão retornou o investimento.</p></div>
      <Button onClick={onAdd} icon={<Plus />} signature>Adicionar dados de mídia</Button>
    </div>
    {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1220px] text-left text-xs">
      <thead className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]"><tr>{["Cliente / campanha", "Investimento", "Leads", "Vendas", "Comissão gerada", "CPL", "CAC", "Conversão", "ROAS VGV", "ROAS VGC"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.key} className="border-t" style={{ borderColor: "var(--border)" }}>
        <td className="px-4 py-3"><strong className="block text-[var(--text-title)]">{row.campaignName}</strong><span className="text-[10px] text-[var(--muted-foreground)]">{row.clientName}</span></td>
        <td className="px-4 py-3">{formatCurrency(row.spend)}</td><td className="px-4 py-3">{row.leads}</td><td className="px-4 py-3">{row.sales}</td><td className="px-4 py-3">{formatCurrency(row.grossCommission)}</td>
        <td className="px-4 py-3">{row.leads ? formatCurrency(row.cpl) : "—"}</td><td className="px-4 py-3">{row.sales ? formatCurrency(row.cac) : "—"}</td><td className="px-4 py-3">{row.leads ? `${row.conversionRate.toFixed(2)}%` : "—"}</td><td className="px-4 py-3">{row.spend ? `${row.roas.toFixed(1)}x` : "—"}</td><td className="px-4 py-3 font-semibold text-emerald-400">{row.spend ? `${row.commercialRoas.toFixed(1)}x` : "—"}</td>
      </tr>)}</tbody>
    </table></div> : <div className="p-5"><MarketingEmptyState title="Sem dados de campanha" description="Informe investimento e leads para calcular CPL, CAC, conversão e ROAS." action={<Button onClick={onAdd} icon={<Plus />}>Adicionar dados</Button>} /></div>}
    {rawRows.length > 0 && <div className="border-t p-4" style={{ borderColor: "var(--border)" }}><div className="mb-3"><p className="text-xs font-semibold text-[var(--text-title)]">Campanhas cadastradas</p><p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Edite ou exclua campanhas de qualquer período sem alterar as vendas já registradas.</p></div><div className="space-y-2">{rawRows.map((row) => <div key={row.id} className="flex flex-col gap-3 rounded-xl border px-3 py-3 text-xs sm:flex-row sm:items-center" style={{ borderColor: "var(--glass-border)" }}><span className="min-w-0 flex-1"><strong className="block truncate text-[var(--text-title)]">{row.campaign_name}</strong><span className="mt-1 block text-[11px] text-[var(--muted-foreground)]">{row.client_name} · {format(parseISO(row.period_start), "dd/MM/yyyy")} a {format(parseISO(row.period_end), "dd/MM/yyyy")} · {formatCurrency(row.spend)} · {row.leads} leads</span></span><div className="grid grid-cols-2 gap-2 sm:flex"><button type="button" onClick={() => onEdit(row)} className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-medium text-[var(--text-body)] transition hover:bg-[var(--hover)] hover:text-[var(--text-title)]" aria-label={`Editar campanha ${row.campaign_name}`}><Pencil size={14} />Editar</button><button type="button" onClick={() => void onDelete(row)} className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-2 font-medium text-red-400 transition hover:bg-red-500/10" aria-label={`Excluir campanha ${row.campaign_name}`}><Trash2 size={14} />Excluir</button></div></div>)}</div></div>}
  </section>;
}

function PerformanceDialog({ open, onOpenChange, clients, defaultStart, defaultEnd, onCreated, onUpdated, row }: { open: boolean; onOpenChange: (open: boolean) => void; clients: Array<{ id: string; name: string }>; defaultStart: string; defaultEnd: string; onCreated: (row: MarketingVgvCampaignPerformance) => void; onUpdated: (row: MarketingVgvCampaignPerformance) => void; row: MarketingVgvCampaignPerformance | null }) {
  const empty = useMemo(() => ({ agency_client_id: "", campaign_name: "", period_start: defaultStart, period_end: defaultEnd, spend: 0, leads: 0 }), [defaultEnd, defaultStart]);
  const [form, setForm] = useState(empty); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(row ? { agency_client_id: row.agency_client_id, campaign_name: row.campaign_name, period_start: row.period_start, period_end: row.period_end, spend: row.spend, leads: row.leads } : empty); }, [empty, open, row]);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); try { const data = await request<{ performance: MarketingVgvCampaignPerformance }>(row ? `/api/marketing/vgv/performance/${row.id}` : "/api/marketing/vgv/performance", { method: row ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); if (row) onUpdated(data.performance); else onCreated(data.performance); onOpenChange(false); toast.success(row ? "Campanha atualizada" : "Dados de campanha adicionados"); } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar"); } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><form onSubmit={submit}><DialogHeader><DialogTitle>{row ? "Editar campanha" : "Dados de mídia da campanha"}</DialogTitle><DialogDescription>Cadastre os totais da campanha para relacionar investimento e leads às vendas e calcular CPL, CAC, conversão e ROAS.</DialogDescription></DialogHeader><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Cliente" id="perf-client" className="sm:col-span-2"><select id="perf-client" required value={form.agency_client_id} onChange={(event) => setForm({ ...form, agency_client_id: event.target.value })} className="lc-form-control crm-form-select"><option value="">Selecionar cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field><Field label="Campanha" id="perf-campaign" className="sm:col-span-2"><Input id="perf-campaign" required value={form.campaign_name} onChange={(event) => setForm({ ...form, campaign_name: event.target.value })} /></Field><Field label="Início" id="perf-start"><Input id="perf-start" type="date" required value={form.period_start} onChange={(event) => setForm({ ...form, period_start: event.target.value })} /></Field><Field label="Fim" id="perf-end"><Input id="perf-end" type="date" required value={form.period_end} onChange={(event) => setForm({ ...form, period_end: event.target.value })} /></Field><Field label="Investimento" id="perf-spend"><MoneyInput value={form.spend} onChange={(spend) => setForm({ ...form, spend })} /></Field><Field label="Leads gerados" id="perf-leads"><Input id="perf-leads" type="number" min="0" step="1" required value={form.leads} onChange={(event) => setForm({ ...form, leads: Number(event.target.value) })} /></Field></div><DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" loading={saving}>{row ? "Salvar alterações" : "Salvar dados"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function VgvFormsSection({ forms, onCreate, onToggle }: { forms: MarketingVgvForm[]; onCreate: () => void; onToggle: (form: MarketingVgvForm) => Promise<void> }) {
  const copy = async (slug: string) => { const url = `${window.location.origin}/venda/${slug}`; await navigator.clipboard.writeText(url); toast.success("Link copiado"); };
  return <section><div className="mb-4 flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}><div><h2 className="text-sm font-semibold">Formulários de registro de venda</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Cada link já identifica o cliente. Regras de comissão permanecem privadas.</p></div><Button onClick={onCreate} icon={<Plus />} signature>Novo formulário</Button></div>{forms.length ? <div className="grid gap-3 md:grid-cols-2">{forms.map((form) => <article key={form.id} className="rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-400"><Link2 size={17} /></span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{form.name}</h3><p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{form.client_name} · {form.custom_fields.length} pergunta(s) extra(s)</p></div><span className={cn("rounded-full px-2 py-1 text-[9px]", form.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400")}>{form.status === "active" ? "Ativo" : "Pausado"}</span></div><div className="mt-4 rounded-xl border p-3 text-[10px] text-[var(--muted-foreground)]" style={{ borderColor: "var(--border)" }}>Configuração privada: comissão-base {form.default_commission_percentage}%{form.include_agency_commission ? ` · Comissão Genesy ${form.agency_share_percentage}%` : " · sem Comissão Genesy"}</div><div className="mt-3 grid grid-cols-3 gap-2"><button onClick={() => void copy(form.slug)} className="flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs"><Copy size={13} />Copiar</button><a href={`/venda/${form.slug}`} target="_blank" className="flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs"><ExternalLink size={13} />Abrir</a><button onClick={() => void onToggle(form)} className="rounded-xl border px-2 py-2 text-xs">{form.status === "active" ? "Pausar" : "Ativar"}</button></div></article>)}</div> : <MarketingEmptyState title="Nenhum formulário de venda" description="Crie um link vinculado ao cliente para receber vendas automaticamente." action={<Button onClick={onCreate} icon={<Plus />}>Criar formulário</Button>} />}</section>;
}

function VgvFormDialog({ open, onOpenChange, clients, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; clients: Array<{ id: string; name: string }>; onCreated: (form: MarketingVgvForm) => void }) {
  const [clientId, setClientId] = useState(""); const [name, setName] = useState(""); const [commission, setCommission] = useState(0); const [includeShare, setIncludeShare] = useState(false); const [share, setShare] = useState(0); const [fields, setFields] = useState<MarketingVgvCustomField[]>([]); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setClientId(""); setName(""); setCommission(0); setIncludeShare(false); setShare(0); setFields([]); } }, [open]);
  const addField = () => setFields((items) => [...items, { id: `campo_${Date.now()}`, label: "", type: "text", required: false, include_in_dashboard: false }]);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); try { const data = await request<{ form: MarketingVgvForm }>("/api/marketing/vgv/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agency_client_id: clientId, name, default_commission_percentage: commission, include_agency_commission: includeShare, agency_share_percentage: share, custom_fields: fields }) }); onCreated(data.form); onOpenChange(false); toast.success("Formulário criado e vinculado ao cliente"); } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao criar formulário"); } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><form onSubmit={submit}><DialogHeader><DialogTitle>Novo formulário de venda</DialogTitle><DialogDescription>O cliente selecionado e as regras financeiras ficam vinculados internamente ao link.</DialogDescription></DialogHeader><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Cliente" id="form-client"><select id="form-client" required value={clientId} onChange={(event) => setClientId(event.target.value)} className="lc-form-control crm-form-select"><option value="">Selecionar cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field><Field label="Nome do formulário" id="form-name"><Input id="form-name" placeholder="Registro de venda" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Comissão do cliente sobre a venda (%)" id="form-commission"><Input id="form-commission" type="number" min="0" max="100" step="0.01" value={commission} onChange={(event) => setCommission(Number(event.target.value))} /></Field><label className="flex items-center justify-between rounded-xl border p-3 text-xs" style={{ borderColor: "var(--glass-border)" }}><span><strong className="block">Incluir Comissão Genesy</strong><span className="text-[10px] text-[var(--muted-foreground)]">Informação privada</span></span><input type="checkbox" checked={includeShare} onChange={(event) => setIncludeShare(event.target.checked)} /></label>{includeShare && <Field label="Comissão Genesy sobre a comissão comercial (%)" id="form-share" className="sm:col-span-2"><Input id="form-share" type="number" min="0" max="100" step="0.01" value={share} onChange={(event) => setShare(Number(event.target.value))} /></Field>}</div><div className="mt-6"><div className="flex items-center justify-between"><div><h3 className="text-xs font-semibold">Perguntas adicionais</h3><p className="text-[10px] text-[var(--muted-foreground)]">As perguntas essenciais já estão incluídas.</p></div><Button type="button" size="sm" variant="outline" onClick={addField} icon={<Plus />}>Adicionar</Button></div><div className="mt-3 space-y-2">{fields.map((field, index) => <div key={field.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_120px_auto]" style={{ borderColor: "var(--glass-border)" }}><Input aria-label={`Pergunta extra ${index + 1}`} required placeholder="Ex.: Renda familiar" value={field.label} onChange={(event) => setFields((items) => items.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item))} /><select value={field.type} onChange={(event) => setFields((items) => items.map((item) => item.id === field.id ? { ...item, type: event.target.value as "text" | "number", include_in_dashboard: event.target.value === "number" && item.include_in_dashboard } : item))} className="lc-form-control crm-form-select"><option value="text">Texto</option><option value="number">Número</option></select><button type="button" onClick={() => setFields((items) => items.filter((item) => item.id !== field.id))} className="p-2 text-red-400"><Trash2 size={15} /></button><label className="text-[10px]"><input type="checkbox" checked={field.required} onChange={(event) => setFields((items) => items.map((item) => item.id === field.id ? { ...item, required: event.target.checked } : item))} /> Obrigatória</label>{field.type === "number" && <label className="text-[10px]"><input type="checkbox" checked={field.include_in_dashboard} onChange={(event) => setFields((items) => items.map((item) => item.id === field.id ? { ...item, include_in_dashboard: event.target.checked } : item))} /> Incluir no dashboard</label>}</div>)}</div></div><DialogFooter className="mt-6"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" loading={saving}>Criar formulário</Button></DialogFooter></form></DialogContent></Dialog>;
}

function Field({ label, id, className = "", children }: { label: string; id: string; className?: string; children: ReactNode }) {
  return <div className={className}><Label htmlFor={id} className="mb-2 text-xs">{label}</Label>{children}</div>;
}

function MetricCard({ label, value, description, icon, accent }: { label: string; value: string; description?: string; icon: ReactNode; accent: string }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border p-4 sm:p-5" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: accent, opacity: 0.14 }} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{label}</p>
          {description && <p className="mt-2 text-[10px] leading-4 text-[var(--muted-foreground)]">{description}</p>}
        </div>
        <span className="rounded-xl p-2 [&_svg]:size-4" style={{ color: accent, background: `${accent}16` }}>{icon}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border p-4 sm:p-5" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
      <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-[#27a3ff]/10 blur-3xl" />
      <h2 className="relative text-sm font-semibold">{title}</h2>
      <p className="relative mb-4 text-xs text-[var(--muted-foreground)]">{description}</p>
      <div className="relative">{children}</div>
    </section>
  );
}
