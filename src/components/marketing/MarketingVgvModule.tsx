"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { addMonths, eachDayOfInterval, eachMonthOfInterval, format, parseISO, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  HandCoins,
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
import { getMarketingVgvPeriodRange, type MarketingVgvPeriodMode } from "@/lib/marketing/vgv-period";
import type { MarketingVgvSale, MarketingVgvSaleInput } from "@/types/marketing";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const tooltipStyle = {
  background: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: 12,
  color: "var(--chart-tooltip-text)",
  boxShadow: "0 14px 38px rgba(0,0,0,.24)",
};
const axisTick = { fill: "var(--text-body)", fontSize: 11 };

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
  const [period, setPeriod] = useState(startOfMonth(new Date()));
  const [periodMode, setPeriodMode] = useState<MarketingVgvPeriodMode>("month");
  const [sales, setSales] = useState<MarketingVgvSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const range = useMemo(() => getMarketingVgvPeriodRange(periodMode, period), [period, periodMode]);
  const rangeStart = format(range.start, "yyyy-MM-dd");
  const rangeEnd = format(range.end, "yyyy-MM-dd");
  const periodSelectorLabel = useMemo(() => {
    if (periodMode === "month") return format(period, "MMMM", { locale: ptBR });
    if (periodMode === "year") return format(period, "yyyy");
    return `${format(range.start, "MMM/yy", { locale: ptBR })} — ${format(addMonths(range.end, -1), "MMM/yy", { locale: ptBR })}`;
  }, [period, periodMode, range.end, range.start]);

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ start: rangeStart, end: rangeEnd });
      const data = await request<{ sales: MarketingVgvSale[] }>(`/api/marketing/vgv?${params}`);
      setSales(data.sales);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar as vendas");
    } finally {
      setIsLoading(false);
    }
  }, [rangeEnd, rangeStart]);

  useEffect(() => { void loadSales(); }, [loadSales]);

  const metrics = useMemo(() => {
    const total = sales.reduce((sum, sale) => sum + sale.sale_value, 0);
    const commissions = sales.reduce((sum, sale) => sum + sale.sale_value * sale.commission_percentage / 100, 0);
    return {
      total,
      commissions,
      count: sales.length,
      averageTicket: sales.length ? total / sales.length : 0,
    };
  }, [sales]);

  const evolutionData = useMemo(() => {
    const totals = new Map<string, number>();
    if (periodMode === "month") {
      for (const sale of sales) totals.set(sale.sale_date, (totals.get(sale.sale_date) ?? 0) + sale.sale_value);
      return eachDayOfInterval({ start: range.start, end: subDays(range.end, 1) }).map((day) => {
        const key = format(day, "yyyy-MM-dd");
        return { date: format(day, "dd"), value: totals.get(key) ?? 0 };
      });
    }

    for (const sale of sales) {
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
  }, [periodMode, range.end, range.start, sales]);

  const brokerData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const sale of sales) totals.set(sale.broker_name, (totals.get(sale.broker_name) ?? 0) + sale.sale_value);
    return Array.from(totals, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [sales]);

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
        actions={<Button onClick={() => setDialogOpen(true)} icon={<Plus size={15} />} signature size="medium">Registrar venda</Button>}
      />}

      <div className={embedded ? "" : "px-4 sm:px-6"}>
        {embedded && <div className="mb-5 flex items-center justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--primary)]">Performance comercial</p><h2 className="mt-1 text-lg font-semibold text-[var(--text-title)]">VGV atribuído ao marketing</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Vendas, ticket e comissão consolidados no período.</p></div><Button onClick={() => setDialogOpen(true)} icon={<Plus size={15} />} signature size="medium">Registrar venda</Button></div>}
        <div className="mb-5 flex flex-col gap-3">
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
        </div>

        {isLoading ? <MarketingSkeleton /> : error ? (
          <MarketingEmptyState title="Não foi possível carregar o VGV" description={error} action={<Button onClick={() => void loadSales()} variant="outline">Tentar novamente</Button>} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard label={periodMode === "month" ? "VGV no mês" : "VGV no período"} value={currency.format(metrics.total)} icon={<TrendingUp />} accent="#27a3ff" />
              <MetricCard label="Vendas registradas" value={metrics.count.toLocaleString("pt-BR")} icon={<ReceiptText />} accent="#27f2e6" />
              <MetricCard label="Ticket médio" value={currency.format(metrics.averageTicket)} icon={<CircleDollarSign />} accent="#a78bfa" />
              <MetricCard label="Comissão estimada" value={currency.format(metrics.commissions)} icon={<HandCoins />} accent="#22c55e" />
            </div>

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
                    <YAxis tick={axisTick} tickFormatter={(value) => compactCurrency.format(Number(value))} tickLine={false} axisLine={false} width={76} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [currency.format(Number(value)), "VGV"]} labelFormatter={(label) => periodMode === "month" ? `Dia ${label}` : String(label)} />
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
                      <XAxis type="number" tick={axisTick} tickFormatter={(value) => compactCurrency.format(Number(value))} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={94} tick={axisTick} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => [currency.format(Number(value)), "VGV"]} />
                      <Bar dataKey="value" fill="url(#vgv-broker-bar)" radius={[3, 9, 9, 3]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="flex h-[270px] items-center justify-center text-sm text-[var(--muted-foreground)]">Registre uma venda para visualizar o ranking.</div>}
              </ChartCard>
            </div>

            <section className="mt-5 overflow-hidden rounded-2xl border" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
              <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h2 className="text-sm font-semibold">Vendas registradas</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">{metrics.count} {metrics.count === 1 ? "registro no período" : "registros no período"}</p>
                </div>
                <UsersRound size={18} className="text-[var(--muted-foreground)]" />
              </div>
              {sales.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                      <tr>
                        <th className="px-5 py-3 font-medium">Data</th>
                        <th className="px-5 py-3 font-medium">Cliente atribuído</th>
                        <th className="px-5 py-3 font-medium">Corretor</th>
                        <th className="px-5 py-3 text-right font-medium">Valor da venda</th>
                        <th className="px-5 py-3 text-right font-medium">Comissão</th>
                        <th className="w-14 px-3 py-3"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((sale) => (
                        <tr key={sale.id} className="border-t transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)" }}>
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs text-[var(--muted-foreground)]">{format(parseISO(sale.sale_date), "dd/MM/yyyy")}</td>
                          <td className="px-5 py-3.5 font-medium">{sale.client_name}</td>
                          <td className="px-5 py-3.5 text-[var(--text-body)]">{sale.broker_name}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold">{currency.format(sale.sale_value)}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <span>{sale.commission_percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</span>
                            <span className="ml-2 text-xs text-[var(--muted-foreground)]">{currency.format(sale.sale_value * sale.commission_percentage / 100)}</span>
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            {sale.can_delete && (
                              <button
                                aria-label={`Apagar venda de ${sale.client_name}`}
                                onClick={() => void deleteSale(sale)}
                                className="rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
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
            </section>
          </>
        )}
      </div>

      <SaleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={format(new Date(), "yyyy-MM-dd") >= rangeStart && format(new Date(), "yyyy-MM-dd") < rangeEnd ? format(new Date(), "yyyy-MM-dd") : rangeStart}
        onCreated={(sale) => {
          if (sale.sale_date >= rangeStart && sale.sale_date < rangeEnd) setSales((items) => [sale, ...items]);
        }}
      />
    </div>
  );
}

function SaleDialog({ open, onOpenChange, defaultDate, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  onCreated: (sale: MarketingVgvSale) => void;
}) {
  const [form, setForm] = useState<MarketingVgvSaleInput>({
    sale_value: 0,
    broker_name: "",
    client_name: "",
    commission_percentage: 0,
    sale_date: defaultDate,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ sale_value: 0, broker_name: "", client_name: "", commission_percentage: 0, sale_date: defaultDate });
  }, [defaultDate, open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const data = await request<{ sale: MarketingVgvSale }>("/api/marketing/vgv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onCreated(data.sale);
      onOpenChange(false);
      toast.success("Venda registrada");
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
            <DialogTitle>Registrar venda</DialogTitle>
            <DialogDescription>Adicione uma venda atribuída ao trabalho de marketing.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Valor da venda" id="vgv-sale-value">
              <MoneyInput value={form.sale_value} onChange={(sale_value) => setForm((current) => ({ ...current, sale_value }))} max={999_999_999.99} />
            </Field>
            <Field label="Data da venda" id="vgv-sale-date">
              <Input id="vgv-sale-date" required type="date" value={form.sale_date} onChange={(event) => setForm((current) => ({ ...current, sale_date: event.target.value }))} />
            </Field>
            <Field label="Nome do corretor" id="vgv-broker">
              <Input id="vgv-broker" required maxLength={160} placeholder="Ex.: Marina Alves" value={form.broker_name} onChange={(event) => setForm((current) => ({ ...current, broker_name: event.target.value }))} />
            </Field>
            <Field label="Cliente atribuído" id="vgv-client">
              <Input id="vgv-client" required maxLength={160} placeholder="Ex.: João e Ana" value={form.client_name} onChange={(event) => setForm((current) => ({ ...current, client_name: event.target.value }))} />
            </Field>
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
                  Comissão estimada: {currency.format(form.sale_value * form.commission_percentage / 100)}
                </p>
              )}
            </Field>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={isSaving} loadingLabel="Salvando">Registrar venda</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, className = "", children }: { label: string; id: string; className?: string; children: ReactNode }) {
  return <div className={className}><Label htmlFor={id} className="mb-2 text-xs">{label}</Label>{children}</div>;
}

function MetricCard({ label, value, icon, accent }: { label: string; value: string; icon: ReactNode; accent: string }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border p-4 sm:p-5" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: accent, opacity: 0.14 }} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{label}</p>
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
