"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Clock, CheckCircle2, PhoneCall, RefreshCw, X, MessageSquare } from "lucide-react";
import { useInadimplencia } from "@/hooks/useInadimplencia";
import { cn } from "@/lib/utils";
import type { CollectionStatus, UpdateCollection } from "@/types";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const SEVERITY_CONFIG = {
  critical: {
    label: "Crítico",
    sub: "30+ dias",
    rowClass: "bg-red-400/[0.04]",
    badgeClass: "text-red-400 bg-red-400/10 border-red-400/30",
    dotClass: "bg-red-400",
    icon: <AlertTriangle size={14} />,
  },
  warning: {
    label: "Atenção",
    sub: "8–29 dias",
    rowClass: "bg-amber-400/[0.03]",
    badgeClass: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    dotClass: "bg-amber-400",
    icon: <Clock size={14} />,
  },
  mild: {
    label: "Recente",
    sub: "1–7 dias",
    rowClass: "",
    badgeClass: "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/30",
    dotClass: "bg-[#b4b4b4]",
    icon: <Clock size={14} />,
  },
};

const STATUS_LABELS: Record<CollectionStatus, string> = {
  pendente: "Pendente",
  em_cobranca: "Em cobrança",
  pago: "Pago",
  perdido: "Perdido",
};

interface ContactModalProps {
  collectionId: string;
  clientName: string;
  amount: number;
  phone?: string;
  onClose: () => void;
  onUpdate: (id: string, data: UpdateCollection) => Promise<void>;
}

function ContactModal({ collectionId, clientName, amount, phone, onClose, onUpdate }: ContactModalProps) {
  useModalOpen(true);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<CollectionStatus>("em_cobranca");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(collectionId, {
      status,
      last_contact_date: new Date().toISOString().split("T")[0],
      contact_notes: notes || null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4"
        style={{ background: "rgba(0,0,0,0.10)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "none" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Registrar Contato</h2>
          <button onClick={onClose} className="text-[#b4b4b4] hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="lc-card p-4 space-y-1">
          <p className="text-white font-semibold">{clientName}</p>
          <p className="text-amber-400 font-bold text-lg">{fmt(amount)}</p>
          {phone && (
            <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:underline mt-1">
              <PhoneCall size={12} />
              {phone} · Abrir WhatsApp
            </a>
          )}
        </div>

        <div>
          <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Status após contato</label>
          <select value={status} onChange={e => setStatus(e.target.value as CollectionStatus)}
            className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none"
            style={{ border: "none" }}>
            <option value="em_cobranca">Em Cobrança</option>
            <option value="pago">Pago</option>
            <option value="perdido">Perdido / Irrecuperável</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Anotações do contato</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={3} placeholder="Ex: Prometeu pagar na sexta..."
            className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none resize-none placeholder:text-[#b4b4b4]/50"
            style={{ border: "none" }} />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-[#b4b4b4] hover:text-white"
            style={{ border: "none" }}>
            Cancelar
          </button>
          <PrimaryButton onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm">
            {saving ? "Salvando..." : "Registrar"}
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}

interface Props {
  year: number;
  month: number;
}

export function Inadimplencia({ year: _year, month: _month }: Props) {
  const { collections, totalInadimplencia, isLoading, markAsPaid, updateCollection, generateFromOverdueRevenues } = useInadimplencia();
  const [contactModal, setContactModal] = useState<{ open: boolean; id: string; name: string; amount: number; phone?: string }>({ open: false, id: "", name: "", amount: 0 });
  const [generating, setGenerating] = useState(false);

  const critical = collections.filter(c => c.severity === "critical");
  const warning = collections.filter(c => c.severity === "warning");
  const mild = collections.filter(c => c.severity === "mild");

  const handleGenerate = async () => {
    setGenerating(true);
    await generateFromOverdueRevenues();
    setGenerating(false);
  };

  const handleContactUpdate = async (id: string, data: UpdateCollection) => {
    await updateCollection(id, data);
  };

  return (
    <div className="space-y-5">
      {/* Alert banner */}
      {totalInadimplencia > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-5 flex items-center gap-4"
          style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.3)" }}
        >
          <div className="w-12 h-12 rounded-2xl bg-red-400/15 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-lg">{fmt(totalInadimplencia)}</p>
            <p className="text-red-300 text-sm">{collections.length} cliente{collections.length !== 1 ? "s" : ""} com pagamento em atraso</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-red-400 bg-red-400/10 px-3 py-1.5 rounded-full font-medium border border-red-400/20">
              {critical.length} crítico{critical.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full font-medium border border-amber-400/20">
              {warning.length} atenção
            </span>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[#b4b4b4]">
          {collections.length === 0 ? "Nenhuma inadimplência ativa" : `${collections.length} cobranças pendentes`}
        </p>
        <button onClick={handleGenerate} disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#b4b4b4] border hover:text-white transition-colors disabled:opacity-50"
          style={{ border: "none" }}>
          <RefreshCw size={14} className={generating ? "animate-spin" : ""} />
          Sincronizar da Gestão de Receitas
        </button>
      </div>

      {isLoading ? (
        <div className="lc-card p-8 text-center text-[#b4b4b4] text-sm">Carregando cobranças...</div>
      ) : collections.length === 0 ? (
        <div className="lc-card p-12 text-center">
          <CheckCircle2 size={40} className="text-emerald-400/40 mx-auto mb-3" />
          <p className="text-emerald-400 text-sm font-semibold mb-1">Nenhuma inadimplência</p>
          <p className="text-[#b4b4b4] text-xs">Todos os clientes estão em dia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {([["critical", critical], ["warning", warning], ["mild", mild]] as const).map(([sev, items]) => {
            if (items.length === 0) return null;
            const sc = SEVERITY_CONFIG[sev];
            return (
              <div key={sev}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full", sc.dotClass)} />
                  <p className="text-xs text-[#b4b4b4] font-medium uppercase tracking-wider">
                    {sc.label} · {sc.sub} · {items.length} cliente{items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="lc-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ border: "none" }}>
                        {["Cliente", "Valor", "Vencimento", "Dias Atraso", "Último Contato", "Status", ""].map(h => (
                          <th key={h} className="text-left text-xs text-[#b4b4b4] font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {items.map((c, i) => (
                          <motion.tr key={c.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className={cn("border-b transition-colors", sc.rowClass)}
                            style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-white font-medium">{(c.client as { name?: string } | undefined)?.name ?? "—"}</p>
                                {(c.client as { contact_phone?: string } | undefined)?.contact_phone && (
                                  <p className="text-xs text-[#b4b4b4]">{(c.client as { contact_phone?: string }).contact_phone}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-white font-bold">{fmt(c.amount)}</p>
                            </td>
                            <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap">
                              {format(parseISO(c.due_date), "dd/MM/yyyy", { locale: ptBR })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full border", sc.badgeClass)}>
                                {c.days_overdue}d
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap text-xs">
                              {c.last_contact_date
                                ? format(parseISO(c.last_contact_date), "dd/MM", { locale: ptBR })
                                : "Nunca"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-xs text-[#b4b4b4] bg-[#b4b4b4]/10 px-2 py-0.5 rounded-full">
                                {STATUS_LABELS[c.status]}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setContactModal({
                                    open: true, id: c.id, amount: c.amount,
                                    name: (c.client as { name?: string } | undefined)?.name ?? "Cliente",
                                    phone: (c.client as { contact_phone?: string } | undefined)?.contact_phone,
                                  })}
                                  className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-[#4a8fd4] hover:bg-[#4a8fd4]/10 transition-colors"
                                  title="Registrar contato">
                                  <MessageSquare size={14} />
                                </button>
                                <button
                                  onClick={() => markAsPaid(c.id)}
                                  className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                                  title="Marcar como pago">
                                  <CheckCircle2 size={14} />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {contactModal.open && (
          <ContactModal
            collectionId={contactModal.id}
            clientName={contactModal.name}
            amount={contactModal.amount}
            phone={contactModal.phone}
            onClose={() => setContactModal(s => ({ ...s, open: false }))}
            onUpdate={handleContactUpdate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
