"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, CalendarDays, FileDown, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { saveTrafficReportPdf } from "@/lib/traffic-report-pdf";
import type { AdPlatformAccount } from "@/types";
import type { TrafficReportData } from "@/types/traffic-report";

export function TrafficReportGenerator({ accounts, selectedAccountId, year, month }: { accounts: AdPlatformAccount[]; selectedAccountId: string | null; year: number; month: number }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const clients = useMemo(() => Array.from(new Map(accounts.filter((account) => account.client_id && account.client).map((account) => [account.client_id as string, account.client!])).entries()), [accounts]);
  const clientAccounts = accounts.filter((account) => account.client_id === clientId);

  useEffect(() => {
    const monthDate = new Date(year, month - 1, 1);
    const today = new Date();
    const monthEnd = endOfMonth(monthDate);
    setSince(format(startOfMonth(monthDate), "yyyy-MM-dd"));
    setUntil(format(monthEnd > today ? today : monthEnd, "yyyy-MM-dd"));
  }, [month, year]);

  useEffect(() => {
    if (!open) return;
    const selected = accounts.find((account) => account.id === selectedAccountId);
    const nextClient = selected?.client_id ?? clientId ?? clients[0]?.[0] ?? "";
    setClientId(nextClient || clients[0]?.[0] || "");
    setAccountId(selected?.client_id === nextClient ? selected.id : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedAccountId]);

  async function generate() {
    if (!clientId || !since || !until) return toast.error("Selecione o cliente e o período");
    setLoading(true);
    try {
      const params = new URLSearchParams({ client_id: clientId, since, until });
      if (accountId) params.set("platform_account_id", accountId);
      const response = await fetch(`/api/trafego/report?${params}`);
      const json = await response.json() as { report?: TrafficReportData; error?: string };
      if (!response.ok || !json.report) throw new Error(json.error ?? "Não foi possível gerar o relatório");
      await saveTrafficReportPdf(json.report);
      toast.success("Relatório de tráfego exportado em PDF");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="lc-filter-control inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[#4a8fd4]" title="Gerar relatório de tráfego pago"><FileDown size={14} /><span className="hidden sm:inline">Gerar relatório</span><span className="sm:hidden">Relatório</span></button>
    <AnimatePresence>{open && <motion.div className="fixed inset-0 z-[10000] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target && !loading) setOpen(false); }}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby="traffic-report-title" initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} className="w-full max-w-lg rounded-3xl border p-5 shadow-2xl sm:p-6" style={{ background: "var(--bg-modal)", borderColor: "var(--border-modal)" }}>
        <div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-[#4a8fd4]"><Sparkles size={12} />PDF mobile-first</p><h2 id="traffic-report-title" className="mt-1 text-lg font-semibold text-[var(--text-title)]">Relatório de tráfego pago</h2><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Escolha o cliente e o intervalo que serão consolidados no relatório.</p></div><button type="button" disabled={loading} onClick={() => setOpen(false)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[var(--icon)]"><X size={15} /></button></div>
        <div className="mt-5 grid gap-4">
          <label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Building2 size={13} className="text-[#4a8fd4]" />Cliente</span><select value={clientId} onChange={(event) => { setClientId(event.target.value); setAccountId(""); }} className="lc-form-control crm-form-select"><option value="">Selecionar cliente</option>{clients.map(([id, client]) => <option key={id} value={id}>{client.name}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs font-medium">Conta de anúncios</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="lc-form-control crm-form-select"><option value="">Todas as contas do cliente</option>{clientAccounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><CalendarDays size={13} />Início</span><input type="date" value={since} max={until || format(new Date(), "yyyy-MM-dd")} onChange={(event) => setSince(event.target.value)} className="lc-form-control" /></label><label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><CalendarDays size={13} />Fim</span><input type="date" value={until} min={since} max={format(new Date(), "yyyy-MM-dd")} onChange={(event) => setUntil(event.target.value)} className="lc-form-control" /></label></div>
        </div>
        <div className="mt-5 rounded-xl border border-sky-500/15 bg-sky-500/[.05] p-3 text-[11px] leading-5 text-[var(--muted-foreground)]">O PDF inclui capa Genesy, métricas em quadrantes, indicadores complementares, melhores campanhas e os criativos disponíveis na sincronização da Meta.</div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={loading} onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2.5 text-xs">Cancelar</button><button type="button" disabled={loading || !clientId || !since || !until} onClick={() => void generate()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#4a8fd4] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-45">{loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}{loading ? "Gerando PDF..." : "Gerar relatório"}</button></div>
      </motion.section>
    </motion.div>}</AnimatePresence>
  </>;
}
