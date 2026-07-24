"use client";

import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LinkifiedText } from "./LinkifiedText";

interface DescriptionEditorDialogProps {
  open: boolean;
  value: string;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function DescriptionEditorDialog({
  open,
  value,
  onOpenChange,
  onChange,
  readOnly = false,
}: DescriptionEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[110]"
        className="z-[120] flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none p-0 sm:h-[min(80dvh,720px)] sm:max-h-[720px] sm:max-w-3xl sm:rounded-2xl"
        style={{
          background: "var(--bg-modal)",
          border: "1px solid var(--border-modal)",
          boxShadow: "0 24px 64px var(--shadow-modal)",
        }}
      >
        <DialogHeader
          className="flex-shrink-0 gap-1 px-5 py-4 pr-14 sm:px-6 sm:py-5"
          style={{ borderBottom: "1px solid var(--border-modal)" }}
        >
          <DialogTitle style={{ color: "var(--text-title)" }}>
            Descrição da tarefa
          </DialogTitle>
          <DialogDescription style={{ color: "var(--muted-foreground)" }}>
            {readOnly
              ? "Visualize toda a descrição da tarefa."
              : "Digite e revise o conteúdo com mais espaço."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-6">
          {readOnly ? (
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl p-4 text-base leading-relaxed"
              style={{
                background: "var(--hover)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-title)",
              }}
            >
              <LinkifiedText text={value || "Nenhuma descrição adicionada."} />
            </div>
          ) : (
            <Textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Adicionar descrição..."
              autoFocus
              className="field-sizing-fixed min-h-0 flex-1 resize-none rounded-xl p-4 text-base leading-relaxed sm:resize-y"
              style={{
                background: "var(--hover)",
                borderColor: "var(--glass-border)",
                color: "var(--text-title)",
              }}
            />
          )}

          <div className="flex flex-shrink-0 items-center justify-between gap-3">
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {value.length.toLocaleString("pt-BR")} caracteres
            </span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {readOnly ? "Fechar" : "Concluir"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DescriptionPreviewButtonProps {
  value: string;
  onClick: () => void;
  readOnly?: boolean;
}

export function DescriptionPreviewButton({ value, onClick, readOnly = false }: DescriptionPreviewButtonProps) {
  return (
    <div
      className="group relative flex min-h-24 w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-[var(--hover)]"
      style={{
        background: "var(--hover)",
        border: "1px solid var(--glass-border)",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={readOnly ? "Visualizar descrição completa" : "Editar descrição em uma janela maior"}
      />
      <span
        className={`pointer-events-none relative z-10 line-clamp-4 flex-1 text-sm leading-relaxed ${value ? "" : "italic"}`}
        style={{ color: value ? "var(--text-title)" : "var(--muted-foreground)" }}
      >
        <LinkifiedText text={value || "Adicionar descrição..."} />
      </span>
      <button
        type="button"
        onClick={onClick}
        className="relative z-20 mt-0.5 flex flex-shrink-0 items-center gap-1 rounded-md text-[11px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ color: "var(--primary)" }}
      >
        <Maximize2 size={13} />
        <span className="hidden sm:inline">{readOnly ? "Visualizar" : "Expandir"}</span>
      </button>
    </div>
  );
}
