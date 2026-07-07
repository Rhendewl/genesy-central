"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Search, Globe, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/lib/supabase";
import { useGlobalStore } from "@/store";
import { toast } from "sonner";
import type { Portal, NewPortal, AgencyClient, AdPlatformAccount } from "@/types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface NovoPortalModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: NewPortal) => Promise<{ error: string | null }>;
  editingPortal?: Portal | null;
  onUpdate?: (id: string, data: Partial<NewPortal>) => Promise<{ error: string | null }>;
}

export function NovoPortalModal({ open, onClose, onSave, editingPortal, onUpdate }: NovoPortalModalProps) {
  const openModal  = useGlobalStore(s => s.openModal);
  const closeModalStore = useGlobalStore(s => s.closeModal);

  const [clients, setClients]          = useState<AgencyClient[]>([]);
  const [metaAccounts, setMetaAccounts] = useState<AdPlatformAccount[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientOpen, setClientOpen]    = useState(false);

  const [selectedClientId, setSelectedClientId]     = useState<string | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [name, setName]   = useState("");
  const [slug, setSlug]   = useState("");
  const [status, setStatus] = useState<"ativo" | "pausado">("ativo");
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]  = useState<string | null>(null);

  // Load clients + meta accounts
  const loadData = useCallback(async () => {
    const supabase = getSupabaseClient();
    const [{ data: cls }, { data: accounts }] = await Promise.all([
      supabase.from("agency_clients").select("*").order("name"),
      supabase.from("ad_platform_accounts").select("*").eq("status", "connected").order("account_name"),
    ]);
    setClients(cls ?? []);
    setMetaAccounts(accounts ?? []);
  }, []);

  useEffect(() => {
    if (open) {
      loadData();
      openModal();
      if (editingPortal) {
        setSelectedClientId(editingPortal.client_id);
        setName(editingPortal.name);
        setSlug(editingPortal.slug);
        setStatus(editingPortal.status);
        setSlugEdited(true);
        setSelectedAccountIds(
          (editingPortal.portal_accounts ?? []).map(a => a.ad_account_id)
        );
      } else {
        setSelectedClientId(null);
        setName("");
        setSlug("");
        setStatus("ativo");
        setSlugEdited(false);
        setSelectedAccountIds([]);
      }
      setError(null);
    }
    return () => { if (open) closeModalStore(); };
  }, [open, editingPortal, openModal, closeModalStore, loadData]);

  // Auto-generate slug from client name
  useEffect(() => {
    if (slugEdited) return;
    const selectedClient = clients.find(c => c.id === selectedClientId);
    if (selectedClient) {
      setSlug(slugify(selectedClient.name));
    }
  }, [selectedClientId, clients, slugEdited]);

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds(prev =>
      prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]
    );
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!name.trim()) { setError("Informe um nome para o portal"); return; }
    if (!slug.trim()) { setError("Informe o slug do link"); return; }
    if (selectedAccountIds.length === 0) { setError("Selecione ao menos uma conta de anúncios"); return; }

    setSaving(true);
    setError(null);

    const payload: NewPortal = {
      client_id: selectedClientId,
      name: name.trim(),
      slug: slug.trim(),
      status,
      ad_account_ids: selectedAccountIds,
    };

    let result: { error: string | null };
    if (editingPortal && onUpdate) {
      result = await onUpdate(editingPortal.id, payload);
    } else {
      result = await onSave(payload);
    }

    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      toast.success(editingPortal ? "Portal atualizado!" : "Portal criado com sucesso!");
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/[0.03] backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
            style={{ pointerEvents: "none" }}
          >
            <div
              className="lc-modal-panel w-full max-w-lg rounded-3xl overflow-hidden"
              style={{ pointerEvents: "auto" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[color-mix(in_srgb,var(--text-title)_7%,transparent)]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(39,163,255,0.12)", border: "1px solid rgba(39,163,255,0.2)" }}
                  >
                    <Globe size={17} style={{ color: "#27a3ff" }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <h2 className="text-[var(--text-title)] font-semibold text-sm">
                      {editingPortal ? "Editar Portal" : "Novo Portal"}
                    </h2>
                    <p className="text-[color-mix(in_srgb,var(--text-title)_40%,transparent)] text-xs">Dashboard público para cliente</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-[color-mix(in_srgb,var(--text-title)_40%,transparent)] hover:text-[var(--text-title)] hover:bg-[var(--hover)] transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

                {/* Cliente */}
                <div>
                  <label className="block text-xs font-medium text-[color-mix(in_srgb,var(--text-title)_60%,transparent)] mb-2">Cliente</label>
                  <div className="relative">
                    <button
                      onClick={() => setClientOpen(o => !o)}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm text-left transition-all",
                        "lc-filter-control"
                      )}
                    >
                      <span className={selectedClient ? "text-[var(--text-title)]" : "text-[color-mix(in_srgb,var(--text-title)_35%,transparent)]"}>
                        {selectedClient ? selectedClient.name : "Selecionar cliente..."}
                      </span>
                      <ChevronDown size={14} className={cn("text-[color-mix(in_srgb,var(--text-title)_40%,transparent)] transition-transform", clientOpen && "rotate-180")} />
                    </button>

                    <AnimatePresence>
                      {clientOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setClientOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-xl overflow-hidden shadow-2xl"
                            style={{ background: "var(--bg-tooltip)", border: "1px solid var(--border-tooltip)" }}
                          >
                            <div className="p-2 border-b border-[color-mix(in_srgb,var(--text-title)_6%,transparent)]">
                              <div className="flex items-center gap-2 px-2">
                                <Search size={13} className="text-[color-mix(in_srgb,var(--text-title)_30%,transparent)] shrink-0" />
                                <input
                                  autoFocus
                                  value={clientSearch}
                                  onChange={e => setClientSearch(e.target.value)}
                                  placeholder="Buscar cliente..."
                                  className="flex-1 bg-transparent text-sm text-[var(--text-title)] placeholder:text-[color-mix(in_srgb,var(--text-title)_30%,transparent)] outline-none py-1"
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto py-1">
                              <button
                                onClick={() => { setSelectedClientId(null); setClientOpen(false); setClientSearch(""); }}
                                className="w-full px-3.5 py-2 text-sm text-left text-[color-mix(in_srgb,var(--text-title)_50%,transparent)] hover:bg-[var(--hover)] hover:text-[var(--text-title)] transition-colors"
                              >
                                Sem cliente
                              </button>
                              {filteredClients.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => { setSelectedClientId(c.id); setClientOpen(false); setClientSearch(""); }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3.5 py-2 text-sm text-left transition-colors",
                                    selectedClientId === c.id
                                      ? "bg-[#27a3ff]/10 text-[var(--text-title)]"
                                      : "text-[color-mix(in_srgb,var(--text-title)_60%,transparent)] hover:bg-[var(--hover)] hover:text-[var(--text-title)]"
                                  )}
                                >
                                  <span className="flex-1 truncate">{c.name}</span>
                                  {selectedClientId === c.id && <Check size={13} className="text-[#27a3ff] shrink-0" />}
                                </button>
                              ))}
                              {filteredClients.length === 0 && (
                                <p className="px-3.5 py-3 text-sm text-[color-mix(in_srgb,var(--text-title)_30%,transparent)] text-center">Nenhum cliente encontrado</p>
                              )}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Contas Meta */}
                <div>
                  <label className="block text-xs font-medium text-[color-mix(in_srgb,var(--text-title)_60%,transparent)] mb-2">
                    Contas de anúncios permitidas
                  </label>
                  {metaAccounts.length === 0 ? (
                    <div className="rounded-xl border border-[color-mix(in_srgb,var(--text-title)_7%,transparent)] px-4 py-3 text-sm text-[color-mix(in_srgb,var(--text-title)_40%,transparent)]">
                      Nenhuma conta Meta conectada. Conecte em Tráfego → Integrações.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {metaAccounts.map(acc => {
                        const selected = selectedAccountIds.includes(acc.account_id ?? "");
                        return (
                          <button
                            key={acc.id}
                            onClick={() => toggleAccount(acc.account_id ?? "")}
                            className={cn(
                              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-left transition-all",
                              selected
                                ? "bg-[#27a3ff]/10 border border-[#27a3ff]/25"
                                : "border border-[color-mix(in_srgb,var(--text-title)_7%,transparent)] hover:border-[var(--glass-border)] hover:bg-[var(--hover)]"
                            )}
                          >
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                              style={{
                                background: selected ? "#27a3ff" : "transparent",
                                border: selected ? "none" : "1.5px solid var(--silver-border)",
                              }}
                            >
                              {selected && <Check size={10} className="text-black" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[var(--text-title)] font-medium truncate leading-tight">{acc.account_name}</p>
                              {acc.account_id && (
                                <p className="text-[color-mix(in_srgb,var(--text-title)_35%,transparent)] text-xs">{acc.account_id}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Nome do Portal */}
                <div>
                  <label className="block text-xs font-medium text-[color-mix(in_srgb,var(--text-title)_60%,transparent)] mb-2">
                    Nome do Portal <span className="text-[color-mix(in_srgb,var(--text-title)_30%,transparent)]">(opcional)</span>
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Dashboard Wisdom"
                    className="lc-filter-control w-full rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-xs font-medium text-[color-mix(in_srgb,var(--text-title)_60%,transparent)] mb-2">Slug do link</label>
                  <div className="flex items-center gap-0">
                    <span
                      className="px-3 py-2.5 text-sm text-[color-mix(in_srgb,var(--text-title)_40%,transparent)] rounded-l-xl border border-r-0 border-[color-mix(in_srgb,var(--text-title)_8%,transparent)] shrink-0"
                      style={{ background: "var(--hover)" }}
                    >
                      /portal/
                    </span>
                    <input
                      value={slug}
                      onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                      placeholder="wisdom"
                      className="lc-filter-control flex-1 rounded-r-xl rounded-l-none px-3.5 py-2.5 text-sm"
                      style={{ borderRadius: "0 12px 12px 0" }}
                    />
                  </div>
                  {slug && (
                    <p className="mt-1.5 text-xs text-[color-mix(in_srgb,var(--text-title)_30%,transparent)]">
                      Link público: <span className="text-[#27a3ff]/70">/portal/{slug}</span>
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-[color-mix(in_srgb,var(--text-title)_60%,transparent)] mb-2">Status</label>
                  <div className="flex gap-2">
                    {(["ativo", "pausado"] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-sm font-medium transition-all border capitalize",
                          status === s
                            ? s === "ativo"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : "border-[color-mix(in_srgb,var(--text-title)_7%,transparent)] text-[color-mix(in_srgb,var(--text-title)_40%,transparent)] hover:text-[var(--text-title)] hover:border-[var(--glass-border)]"
                        )}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/08 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[color-mix(in_srgb,var(--text-title)_7%,transparent)]">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm text-[color-mix(in_srgb,var(--text-title)_50%,transparent)] hover:text-[var(--text-title)] hover:bg-[var(--hover)] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="lc-btn px-5 py-2 text-sm rounded-xl disabled:opacity-40"
                >
                  {saving ? "Salvando..." : editingPortal ? "Salvar alterações" : "Criar portal"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
