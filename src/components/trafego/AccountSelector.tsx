"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdPlatformAccount } from "@/types";

interface AccountSelectorProps {
  accounts:          AdPlatformAccount[];
  selectedAccountId: string | null;
  onChange:          (id: string | null) => void;
  compact?:          boolean;
}

export function AccountSelector({ accounts, selectedAccountId, onChange, compact = false }: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  if (accounts.length === 0) return null;

  const selected = accounts.find(a => a.id === selectedAccountId);
  const label = selected ? selected.account_name : "Todas as contas";

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen(o => !o);
  };

  return (
    <div className="relative" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className={cn(
          "lc-card flex items-center gap-2 transition-all",
          compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
          open && "ring-1 ring-white/20"
        )}
      >
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: selectedAccountId ? "#4a8fd4" : "#22c55e" }}
        />
        <span className={cn("text-white font-medium truncate", compact ? "max-w-[100px]" : "max-w-[140px]")}>{label}</span>
        {accounts.length > 1 && (
          <span className="text-[10px] text-[#5a5a5a] bg-white/5 px-1.5 py-0.5 rounded-full">
            {accounts.length}
          </span>
        )}
        <ChevronDown
          size={13}
          className={cn("text-[#b4b4b4] transition-transform shrink-0", open && "rotate-180")}
        />
      </button>

      {mounted && createPortal(
        <>
          {/* Backdrop */}
          {open && (
            <div
              className="fixed inset-0"
              style={{ zIndex: 9998 }}
              onClick={() => setOpen(false)}
            />
          )}
          {/* Dropdown — AnimatePresence inside the portal */}
          <AnimatePresence>
            {open && (
              <motion.div
                key="account-dropdown"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, minWidth: 220 }}
              >
                <div
                  className="rounded-xl shadow-2xl"
                  style={{
                    background: "rgba(0,0,0,0.10)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                  }}
                >
                  <button
                    onClick={() => { onChange(null); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors text-left",
                      !selectedAccountId ? "bg-white/10 text-white" : "text-[#b4b4b4] hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="font-medium">Todas as contas</span>
                    {!selectedAccountId && <span className="ml-auto text-white/70 text-xs">✓</span>}
                  </button>

                  <div className="mx-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }} />

                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => { onChange(acc.id); setOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors text-left",
                        selectedAccountId === acc.id ? "bg-white/10 text-white" : "text-[#b4b4b4] hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background: acc.status === "connected" ? "#4a8fd4"
                            : acc.status === "error" ? "#ef4444" : "#5a5a5a",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate leading-tight">{acc.account_name}</p>
                        {acc.client && <p className="text-[10px] text-[#5a5a5a] truncate">{acc.client.name}</p>}
                      </div>
                      {selectedAccountId === acc.id && <span className="ml-auto text-white/70 text-xs shrink-0">✓</span>}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </div>
  );
}
