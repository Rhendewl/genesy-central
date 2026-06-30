"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { FormStepType } from "@/types";
import { BLOCK_DEFINITIONS, BLOCK_CATEGORIES } from "./blocks";

interface AddContentModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: FormStepType) => void;
}

export function AddContentModal({ open, onClose, onAdd }: AddContentModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 w-full max-w-md rounded-2xl p-4 lc-modal-panel overflow-y-auto"
            style={{ maxHeight: "80vh" }}
            role="dialog"
            aria-modal="true"
            aria-label="Adicionar conteúdo"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
                  Adicionar conteúdo
                </h3>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  Escolha o tipo de pergunta
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Fechar"
              >
                <X size={14} style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>

            {/* Blocks grouped by category */}
            <div className="flex flex-col gap-4">
              {BLOCK_CATEGORIES.map(cat => {
                const blocks = BLOCK_DEFINITIONS.filter(b => b.category === cat.key);
                if (!blocks.length) return null;
                return (
                  <div key={cat.key}>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-widest px-1 mb-2"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {cat.label}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {blocks.map(block => (
                        <button
                          key={block.type}
                          onClick={() => onAdd(block.type)}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/5 active:scale-95"
                          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${block.color}18` }}
                            aria-hidden="true"
                          >
                            <block.icon size={14} style={{ color: block.color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: "var(--text-title)" }}>
                              {block.label}
                            </p>
                            <p className="text-[10px] truncate leading-tight mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                              {block.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
