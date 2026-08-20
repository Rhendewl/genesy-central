"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmActionModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel = "Excluir",
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmActionModalProps) {
  if (!open) return null;

  return (
    <div className="lc-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={(event) => { if (event.target === event.currentTarget && !loading) onCancel(); }}>
      <div className="lc-modal-panel w-full max-w-sm overflow-hidden rounded-2xl text-[var(--text-title)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
              <AlertTriangle size={17} />
            </span>
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{description}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={loading} aria-label="Fechar" className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-title)] disabled:opacity-40"><X size={15} /></button>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button type="button" variant="danger" size="sm" onClick={() => void onConfirm()} disabled={loading} icon={loading ? <Loader2 className="animate-spin" /> : <AlertTriangle />}>
            {loading ? "Excluindo" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
