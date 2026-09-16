"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, CalendarDays, FileDown, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { saveTrafficReportPdf } from "@/lib/traffic-report-pdf";
import type { TrafficReportFileHandle } from "@/lib/traffic-report-pdf";
import { trafficReportFilename } from "@/lib/traffic-report";
import { Button } from "@/components/ui/button";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import type { AdPlatformAccount } from "@/types";
import type { TrafficReportData } from "@/types/traffic-report";

export function TrafficReportGenerator({ accounts, selectedAccountId, year, month }: { accounts: AdPlatformAccount[]; selectedAccountId: string | null; year: number; month: number }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const { clients: agencyClients, isLoading: clientsLoading } = useAgencyClients();
  const clients = useMemo(() => {
    const available = new Map(agencyClients.map((client) => [client.id, { id: client.id, name: client.name }]));
    accounts.forEach((account) => {
      if (account.client_id && account.client && !available.has(account.client_id)) {
        available.set(account.client_id, { id: account.client_id, name: account.client.name });
      }
    });
    return Array.from(available.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [accounts, agencyClients]);
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
    const nextClient = selected?.client_id ?? clientId ?? clients[0]?.id ?? "";
    setClientId(nextClient || clients[0]?.id || "");
    setAccountId(selected?.client_id === nextClient ? selected.id : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedAccountId]);

  async function generate() {
    if (!clientId || !since || !until) return toast.error("Selecione o cliente e o período");
    let fileHandle: TrafficReportFileHandle;
    const showSaveFilePicker = (window as Window & { showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<TrafficReportFileHandle> }).showSaveFilePicker;
    if (!showSaveFilePicker) {
      toast.error("Este navegador não permite escolher uma pasta. Abra a plataforma no Chrome ou Edge para salvar o relatório. Nenhum arquivo foi baixado.", { duration: 8000 });
      return;
    }
    try {
      const clientName = clients.find((client) => client.id === clientId)?.name ?? "cliente";
      fileHandle = await showSaveFilePicker.call(window, {
        suggestedName: trafficReportFilename(clientName, since, until),
        types: [{ description: "Relatório PDF", accept: { "application/pdf": [".pdf"] } }],
      });
    } catch (pickerError) {
      if (pickerError instanceof DOMException && pickerError.name === "AbortError") return;
      toast.error("Não foi possível abrir a escolha de pasta");
      return;
    }
    setLoading(true);
    try {
      const accountsToSync = accountId
        ? clientAccounts.filter((account) => account.id === accountId)
        : clientAccounts.filter((account) => account.status === "connected");
      const syncResults = await Promise.all(accountsToSync.map(async (account) => {
        const response = await fetch("/api/meta/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platformAccountId: account.id, since, until }),
        });
        const json = await response.json() as { error?: string };
        return response.ok ? null : (json.error ?? `Falha ao atualizar ${account.account_name}`);
      }));
      const syncError = syncResults.find(Boolean);
      if (syncError) throw new Error(`A Meta não pôde ser atualizada: ${syncError}`);

      const params = new URLSearchParams({ client_id: clientId, since, until });
      if (accountId) params.set("platform_account_id", accountId);
      const response = await fetch(`/api/trafego/report?${params}`);
      const json = await response.json() as { report?: TrafficReportData; error?: string };
      if (!response.ok || !json.report) throw new Error(json.error ?? "Não foi possível gerar o relatório");
      await saveTrafficReportPdf(json.report, fileHandle);
      toast.success("Relatório de tráfego exportado em PDF");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="lc-filter-control inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--text-body)]" title="Gerar relatório de tráfego pago"><FileDown size={14} /><span className="hidden sm:inline">Gerar relatório</span><span className="sm:hidden">Relatório</span></button>
    {typeof document !== "undefined" && createPortal(<AnimatePresence>{open && <motion.div className="fixed inset-0 z-[10000] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target && !loading) setOpen(false); }}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby="traffic-report-title" initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} className="my-auto w-full max-w-lg rounded-3xl border p-5 shadow-2xl sm:p-6" style={{ background: "var(--bg-modal)", borderColor: "var(--border-modal)" }}>
        <div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-[#9d7e4e]"><Sparkles size={12} />Relatório executivo</p><h2 id="traffic-report-title" className="mt-1 text-lg font-semibold text-[var(--text-title)]">Relatório de tráfego pago</h2><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Escolha o cliente e o intervalo que serão consolidados no relatório.</p></div><button type="button" disabled={loading} onClick={() => setOpen(false)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[var(--icon)]"><X size={15} /></button></div>
        <div className="mt-5 grid gap-4">
          <label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Building2 size={13} className="text-[#355366]" />Cliente atribuído</span><select value={clientId} disabled={clientsLoading && !clients.length} onChange={(event) => { setClientId(event.target.value); setAccountId(""); }} className="lc-form-control crm-form-select"><option value="">{clientsLoading && !clients.length ? "Carregando clientes..." : "Selecionar cliente"}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs font-medium">Conta de anúncios</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="lc-form-control crm-form-select"><option value="">Todas as contas do cliente</option>{clientAccounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><CalendarDays size={13} />Início</span><input type="date" value={since} max={until || format(new Date(), "yyyy-MM-dd")} onChange={(event) => setSince(event.target.value)} className="lc-form-control" /></label><label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><CalendarDays size={13} />Fim</span><input type="date" value={until} min={since} max={format(new Date(), "yyyy-MM-dd")} onChange={(event) => setUntil(event.target.value)} className="lc-form-control" /></label></div>
        </div>
        <div className="mt-5 rounded-xl border border-[#9d7e4e]/20 bg-[#9d7e4e]/[.06] p-3 text-[11px] leading-5 text-[var(--muted-foreground)]">Antes de gerar, a plataforma atualiza na Meta somente a conta e o período selecionados. Ao continuar, você escolherá a pasta e o nome do PDF.</div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={loading} onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2.5 text-xs">Cancelar</button><Button type="button" size="lg" disabled={!clientId || !since || !until} loading={loading} loadingLabel="Gerando PDF..." onClick={() => void generate()} icon={<FileDown size={14} />}>Gerar relatório</Button></div>
      </motion.section>
    </motion.div>}</AnimatePresence>, document.body)}
  </>;
}
