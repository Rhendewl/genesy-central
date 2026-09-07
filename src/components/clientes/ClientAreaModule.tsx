"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeDollarSign, ClipboardCheck } from "lucide-react";
import { CommercialAnalysisModule } from "@/components/clientes/CommercialAnalysisModule";
import { MarketingVgvModule } from "@/components/marketing/MarketingVgvModule";
import { cn } from "@/lib/utils";

type AreaTab = "vgv" | "analise_comercial";

const tabs = [
  { id: "vgv" as const, label: "VGV", icon: BadgeDollarSign },
  { id: "analise_comercial" as const, label: "Análise Comercial", icon: ClipboardCheck },
];

export function ClientAreaModule() {
  const [activeTab, setActiveTab] = useState<AreaTab>("vgv");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("area");
    if (requested === "analise_comercial" || requested === "vgv") setActiveTab(requested);
  }, []);

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[var(--primary)]">Área de Clientes</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Receita atribuída, percepção dos corretores e inteligência de marketing.</p>
      </div>
      <nav className="flex w-full gap-1 rounded-xl border p-1 sm:w-auto" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}>
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActiveTab(id)} className={cn("flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-xs font-semibold transition sm:flex-none", activeTab === id ? "text-[var(--text-title)]" : "text-[var(--muted-foreground)] hover:text-[var(--text-title)]")} style={activeTab === id ? { background: "var(--segment-active-bg)", boxShadow: "var(--segment-active-shadow)" } : {}}><Icon size={15} />{label}</button>)}
      </nav>
    </div>

    <AnimatePresence mode="wait">
      <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
        {activeTab === "vgv" ? <MarketingVgvModule embedded /> : <CommercialAnalysisModule />}
      </motion.div>
    </AnimatePresence>
  </div>;
}
