"use client";

import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Calendar } from "lucide-react";
import { useFluxoCaixa } from "@/hooks/useFluxoCaixa";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl"
      style={{ background: "rgba(0,0,0,0.10)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "none" }}>
      <p className="text-[#b4b4b4] text-xs mb-2 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#c7e5ff] text-xs">{p.name}:</span>
          <span className="text-white font-semibold text-xs">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
  delay?: number;
}

function SummaryCard({ label, value, icon, accent, sub, delay = 0 }: SummaryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="lc-card p-5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ color: "#ffffff" }}>
          {icon}
        </div>
        <p className="text-xs font-medium" style={{ color: "#b4b4b4" }}>{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{ color: value >= 0 ? "white" : "#ef4444" }}>
        {fmt(value)}
      </p>
      {sub && <p className="text-xs text-[#b4b4b4]">{sub}</p>}
    </motion.div>
  );
}

interface Props {
  year: number;
  month: number;
}

export function FluxoCaixa({ year, month }: Props) {
  const { summary, entries, chartData, isLoading } = useFluxoCaixa(year, month);

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="lc-card p-5 h-32 animate-pulse">
            <div className="w-9 h-9 rounded-xl bg-white/5 mb-3" />
            <div className="h-3 bg-white/5 rounded w-2/3 mb-2" />
            <div className="h-6 bg-white/5 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const projColor = (v: number) => v >= 0 ? "#10b981" : "#ef4444";

  return (
    <div className="space-y-5">
      {/* Summary 2x4 grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Entradas Previstas" value={summary.entradas_previstas} icon={<ArrowUpRight size={16} />} accent="#4a8fd4" sub="Status pendente" delay={0} />
        <SummaryCard label="Entradas Recebidas" value={summary.entradas_recebidas} icon={<TrendingUp size={16} />} accent="#22c55e" sub="Pagamentos confirmados" delay={0.05} />
        <SummaryCard label="Saídas Previstas" value={summary.saidas_previstas} icon={<ArrowDownRight size={16} />} accent="#f59e0b" sub="Despesas do período" delay={0.1} />
        <SummaryCard label="Saídas Pagas" value={summary.saidas_pagas} icon={<TrendingDown size={16} />} accent="#ef4444" sub="Confirmadas" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="lc-card p-6 flex flex-col items-center justify-center text-center gap-2"
          style={{ border: `1px solid ${summary.saldo_atual >= 0 ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}` }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
            style={{ background: summary.saldo_atual >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}>
            <Wallet size={22} style={{ color: summary.saldo_atual >= 0 ? "#22c55e" : "#ef4444" }} />
          </div>
          <p className="text-xs text-[#b4b4b4] font-medium">Saldo Atual</p>
          <p className="text-3xl font-black" style={{ color: summary.saldo_atual >= 0 ? "#22c55e" : "#ef4444" }}>
            {fmt(summary.saldo_atual)}
          </p>
        </motion.div>

        <div className="lg:col-span-3 grid grid-cols-3 gap-4">
          {([
            { label: "Projeção 30 dias", value: summary.projecao_30, icon: <Calendar size={16} /> },
            { label: "Projeção 60 dias", value: summary.projecao_60, icon: <Calendar size={16} /> },
            { label: "Projeção 90 dias", value: summary.projecao_90, icon: <Calendar size={16} /> },
          ] as const).map((p, i) => (
            <motion.div key={p.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              className="lc-card p-5 flex flex-col gap-2"
              style={{ border: `1px solid ${projColor(p.value)}33` }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${projColor(p.value)}22`, color: projColor(p.value) }}>
                {p.icon}
              </div>
              <p className="text-xs text-[#b4b4b4]">{p.label}</p>
              <p className="text-xl font-bold" style={{ color: projColor(p.value) }}>{fmt(p.value)}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="lc-card p-6"
      >
        <h3 className="text-sm font-semibold text-white mb-1">Fluxo por Semana</h3>
        <p className="text-xs text-[#b4b4b4] mb-5">Entradas vs saídas no mês</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gradEnt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSai" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="data" tick={{ fill: "#b4b4b4", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#b4b4b4", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#b4b4b4" }} />
            <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#22c55e" strokeWidth={2} fill="url(#gradEnt)" />
            <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} fill="url(#gradSai)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Transactions list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="lc-card overflow-hidden"
      >
        <div className="px-5 py-4 border-b" style={{ border: "none" }}>
          <h3 className="text-sm font-semibold text-white">Movimentações do Período</h3>
        </div>
        {entries.length === 0 ? (
          <div className="p-8 text-center text-[#b4b4b4] text-sm">Nenhuma movimentação no período</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  {["Tipo", "Descrição", "Cliente", "Data", "Valor", "Status"].map(h => (
                    <th key={h} className="text-left text-xs text-[#b4b4b4] font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 30).map(e => (
                  <tr key={e.id} className="border-b hover:bg-white/[0.02] transition-colors"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn("flex items-center gap-1 w-fit text-xs font-medium px-2.5 py-1 rounded-full",
                        e.type === "entrada"
                          ? "text-emerald-400 bg-emerald-400/10"
                          : "text-red-400 bg-red-400/10")}>
                        {e.type === "entrada" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {e.type === "entrada" ? "Entrada" : "Saída"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white max-w-[200px] truncate">{e.description}</td>
                    <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap">{e.client_name ?? "—"}</td>
                    <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap">
                      {format(parseISO(e.date), "dd/MM/yy", { locale: ptBR })}
                    </td>
                    <td className={cn("px-4 py-3 font-semibold whitespace-nowrap",
                      e.type === "entrada" ? "text-emerald-400" : "text-red-400")}>
                      {e.type === "entrada" ? "+" : "−"}{fmt(e.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full",
                        e.status === "realizado"
                          ? "text-emerald-400 bg-emerald-400/10"
                          : "text-amber-400 bg-amber-400/10")}>
                        {e.status === "realizado" ? "Realizado" : "Previsto"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
