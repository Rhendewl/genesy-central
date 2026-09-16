"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, CalendarDays, FileDown, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { calculateVgvIntelligence, relateCampaignPerformanceToSales } from "@/lib/marketing/vgv-intelligence";
import { saveVgvCommercialReportPdf, vgvCommercialReportFilename, type VgvCommercialReportFileHandle } from "@/lib/vgv-commercial-report-pdf";
import type { MarketingVgvCampaignPerformance, MarketingVgvSale } from "@/types/marketing";

type Client = { id: string; name: string };

export function VgvCommercialReportGenerator({
  clients,
  selectedClientId,
  since,
  until,
  sales,
  performance,
  registeredCampaigns,
}: {
  clients: Client[];
  selectedClientId: string;
  since: string;
  until: string;
  sales: MarketingVgvSale[];
  performance: MarketingVgvCampaignPerformance[];
  registeredCampaigns: MarketingVgvCampaignPerformance[];
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const sortedClients = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [clients]);

  useEffect(() => {
    if (!open) return;
    setClientId(selectedClientId !== "all" ? selectedClientId : sortedClients[0]?.id ?? "");
  }, [open, selectedClientId, sortedClients]);

  async function generate() {
    const client = sortedClients.find((item) => item.id === clientId);
    if (!client) return toast.error("Selecione o cliente do relatório");

    let fileHandle: VgvCommercialReportFileHandle | undefined;
    const showSaveFilePicker = (window as Window & { showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<VgvCommercialReportFileHandle> }).showSaveFilePicker;
    if (showSaveFilePicker) {
      try {
        fileHandle = await showSaveFilePicker.call(window, {
          suggestedName: vgvCommercialReportFilename(client.name, since, until),
          types: [{ description: "Relatório PDF", accept: { "application/pdf": [".pdf"] } }],
        });
      } catch (pickerError) {
        if (pickerError instanceof DOMException && pickerError.name === "AbortError") return;
        toast.error("Não foi possível abrir a escolha de pasta");
        return;
      }
    }

    setLoading(true);
    try {
      const clientSales = sales.filter((sale) => sale.agency_client_id === clientId);
      const clientCampaigns = registeredCampaigns.filter((row) => row.agency_client_id === clientId);
      const clientPerformance = performance.filter((row) => row.agency_client_id === clientId);
      const relatedPerformance = relateCampaignPerformanceToSales(clientCampaigns, clientPerformance, clientSales);
      const metrics = calculateVgvIntelligence(clientSales, relatedPerformance);
      await saveVgvCommercialReportPdf({
        clientName: client.name,
        since,
        until,
        generatedAt: new Date().toISOString(),
        metrics,
      }, fileHandle);
      toast.success("Relatório comercial exportado em PDF");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="lc-filter-control inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--text-body)]" title="Gerar relatório de performance comercial"><FileDown size={14} /><span className="hidden sm:inline">Gerar relatório</span><span className="sm:hidden">Relatório</span></button>
    {typeof document !== "undefined" && createPortal(<AnimatePresence>{open && <motion.div className="fixed inset-0 z-[10000] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target && !loading) setOpen(false); }}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby="vgv-report-title" initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} className="my-auto w-full max-w-lg rounded-3xl border p-5 shadow-2xl sm:p-6" style={{ background: "var(--bg-modal)", borderColor: "var(--border-modal)" }}>
        <div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--muted-foreground)]"><Sparkles size={12} />Relatório executivo</p><h2 id="vgv-report-title" className="mt-1 text-lg font-semibold text-[var(--text-title)]">Performance comercial</h2><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Selecione o cliente. O PDF usará o período que está aberto no dashboard.</p></div><button type="button" disabled={loading} onClick={() => setOpen(false)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[var(--icon)]"><X size={15} /></button></div>
        <div className="mt-5 grid gap-4">
          <label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Building2 size={13} />Cliente</span><select value={clientId} onChange={(event) => setClientId(event.target.value)} className="lc-form-control crm-form-select"><option value="">Selecionar cliente</option>{sortedClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg-soft)" }}><span className="flex items-center gap-1.5 text-xs font-medium"><CalendarDays size={13} />Período do relatório</span><p className="mt-1 text-xs text-[var(--muted-foreground)]">{new Date(`${since}T12:00:00`).toLocaleDateString("pt-BR")} a {new Date(`${until}T12:00:00`).toLocaleDateString("pt-BR")}</p></div>
        </div>
        <div className="mt-5 rounded-xl border p-3 text-[11px] leading-5 text-[var(--muted-foreground)]" style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg-soft)" }}>O arquivo terá duas páginas em fundo preto: capa e resumo com investimento, VGV, VGC, funil e ROAS.</div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={loading} onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2.5 text-xs">Cancelar</button><Button type="button" size="lg" disabled={!clientId} loading={loading} loadingLabel="Gerando PDF..." onClick={() => void generate()} icon={<FileDown size={14} />}>Gerar relatório</Button></div>
      </motion.section>
    </motion.div>}</AnimatePresence>, document.body)}
  </>;
}
