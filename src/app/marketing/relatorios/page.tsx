"use client";

import { useMemo, useState, type ReactNode } from "react";
import { differenceInDays, endOfMonth, format, startOfMonth } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { MarketingEmptyState, MarketingSkeleton } from "@/components/marketing/MarketingUI";
import { useMarketing } from "@/context/MarketingContext";
import { marketingStats } from "@/lib/marketing/domain";
import { CONTENT_STATUS_LABELS, FORMAT_LABELS, PLATFORM_LABELS } from "@/types/marketing";

const CHART_COLORS = ["#27a3ff", "#27f2e6", "#22c55e", "#a78bfa", "#fe7b4a", "#f472b6", "#94a3b8"];
const axisTick = { fill: "var(--text-body)", fontSize: 11 };
const tooltipStyle = {
  background: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: 12,
  color: "var(--chart-tooltip-text)",
  boxShadow: "0 14px 38px rgba(0,0,0,.24)",
  backdropFilter: "blur(18px)",
};

export default function MarketingReportsPage() {
  const marketing = useMarketing();
  const [start, setStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const contents = useMemo(
    () => marketing.contents.filter((item) => {
      const date = item.scheduled_at ? new Date(item.scheduled_at) : new Date(item.created_at);
      return date >= new Date(`${start}T00:00:00`) && date <= new Date(`${end}T23:59:59`);
    }),
    [end, marketing.contents, start],
  );
  const stats = marketingStats(contents);
  const platforms = Object.entries(PLATFORM_LABELS)
    .map(([id, name]) => ({ name, value: contents.filter((item) => item.platform === id).length }))
    .filter((item) => item.value);
  const formats = Object.entries(FORMAT_LABELS)
    .map(([id, name]) => ({ name, value: contents.filter((item) => item.format === id).length }))
    .filter((item) => item.value);
  const statuses = Object.entries(CONTENT_STATUS_LABELS)
    .map(([id, name]) => ({ name, value: contents.filter((item) => item.status === id).length }))
    .filter((item) => item.value);
  const published = contents.filter((item) => item.published_at);
  const avgDays = published.length
    ? Math.round(published.reduce((sum, item) => sum + differenceInDays(new Date(item.published_at!), new Date(item.created_at)), 0) / published.length)
    : 0;
  const productivity = marketing.members
    .map((member) => ({ name: member.full_name, value: contents.filter((item) => item.primary_assignee_id === member.id && item.status === "published").length }))
    .sort((a, b) => b.value - a.value)
    .filter((item) => item.value);
  const frequency = useMemo(() => {
    const map = new Map<string, number>();
    contents.filter((item) => item.status === "published" && item.published_at).forEach((item) => {
      const key = format(new Date(item.published_at!), "dd/MM");
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [contents]);

  return (
    <div className="pb-10">
      <Header title="Relatórios de Marketing" subtitle="Métricas internas da operação editorial" />
      <div className="px-4 sm:px-6">
        <div className="mb-5 flex flex-wrap gap-3">
          <DateFilter label="De" value={start} onChange={setStart} />
          <DateFilter label="Até" value={end} onChange={setEnd} />
        </div>

        {marketing.isLoading ? <MarketingSkeleton /> : contents.length === 0 ? (
          <MarketingEmptyState title="Nenhum dado no período" description="Os relatórios serão preenchidos a partir dos conteúdos reais cadastrados." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric label="Planejados" value={stats.total} accent="#27a3ff" />
              <Metric label="Publicados" value={stats.published} accent="#22c55e" />
              <Metric label="Taxa de conclusão" value={`${stats.completionRate}%`} accent="#27f2e6" />
              <Metric label="Atrasados" value={stats.overdue} accent="#fe7b4a" />
              <Metric label="Criação → publicação" value={`${avgDays} dias`} accent="#a78bfa" />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <ChartCard title="Conteúdos por plataforma" description="Onde a operação está concentrando suas publicações">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={platforms} dataKey="value" nameKey="name" innerRadius={66} outerRadius={98} paddingAngle={4} cornerRadius={8} stroke="transparent">
                      {platforms.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--hover)" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "var(--text-body)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Distribuição por status" description="Volume atual em cada etapa do fluxo editorial">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={statuses} margin={{ top: 14, right: 6, left: -22, bottom: 8 }}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 6" vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} interval={0} angle={-16} textAnchor="end" height={58} />
                    <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--hover)" }} />
                    <Bar dataKey="value" name="Conteúdos" radius={[8, 8, 3, 3]} maxBarSize={42}>
                      {statuses.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Quantidade por formato" description="Mix de formatos utilizados no período">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={formats} layout="vertical" margin={{ top: 8, right: 16, left: 2, bottom: 4 }}>
                    <defs>
                      <linearGradient id="marketing-format-gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#27a3ff" stopOpacity={0.72} />
                        <stop offset="100%" stopColor="#27f2e6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 6" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" width={92} tick={axisTick} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--hover)" }} />
                    <Bar dataKey="value" name="Conteúdos" fill="url(#marketing-format-gradient)" radius={[3, 9, 9, 3]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Frequência de publicação" description="Publicações realizadas por dia">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={frequency} margin={{ top: 14, right: 8, left: -22, bottom: 4 }}>
                    <defs>
                      <linearGradient id="marketing-frequency-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 6" vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(34,197,94,.4)", strokeDasharray: "4 4" }} />
                    <Area type="monotone" dataKey="value" name="Publicações" stroke="#22c55e" strokeWidth={3} fill="url(#marketing-frequency-area)" activeDot={{ r: 5, fill: "#22c55e", stroke: "var(--text-title)", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <section className="mt-5 rounded-2xl border p-5" style={{ background: "var(--glass-bg-soft)" }}>
              <h2 className="text-sm font-semibold">Produtividade por responsável</h2>
              <p className="mb-4 text-xs text-[var(--muted-foreground)]">Ranking por conteúdos publicados no período</p>
              {productivity.length ? productivity.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3 border-t py-3 text-sm">
                  <span className="w-5 text-[var(--muted-foreground)]">{index + 1}</span>
                  <span className="flex-1">{item.name}</span>
                  <strong>{item.value}</strong>
                </div>
              )) : <p className="text-sm text-[var(--muted-foreground)]">Nenhuma publicação atribuída.</p>}
            </section>

            <div className="mt-5 flex gap-3 rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}>
              <Info size={18} className="shrink-0 text-[#27a3ff]" />
              <div>
                <p className="text-sm font-medium">Insights de redes sociais</p>
                <p className="text-xs text-[var(--muted-foreground)]">A arquitetura separa métricas internas das futuras métricas externas. Alcance, impressões e engajamento aparecerão somente após uma integração oficial com a Meta.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-medium">{label}<input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="ml-2 rounded-lg border px-2 py-1.5" style={{ background: "var(--bg-modal)" }} /></label>;
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}>
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <span className="absolute -right-5 -top-5 h-16 w-16 rounded-full blur-2xl" style={{ background: accent, opacity: 0.16 }} />
      <p className="relative text-2xl font-semibold">{value}</p>
      <p className="relative mt-1 text-xs text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border p-5" style={{ background: "var(--glass-bg-soft)" }}>
      <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-[#27a3ff]/10 blur-3xl" />
      <h2 className="relative text-sm font-semibold">{title}</h2>
      <p className="relative mb-4 text-xs text-[var(--muted-foreground)]">{description}</p>
      <div className="relative">{children}</div>
    </section>
  );
}
