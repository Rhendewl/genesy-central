"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsers } from "@/hooks/useUsers";
import { AssigneeAvatarGroup } from "./AssigneeAvatarGroup";

interface AssigneePickerProps {
  value:    string[];
  onChange: (assigneeIds: string[]) => void;
}

export function AssigneePicker({ value, onChange }: AssigneePickerProps) {
  const { profiles } = useUsers();
  const activeProfiles = profiles.filter((p) => p.is_active);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left, width: r.width });
    }
    setOpen((o) => !o);
  };

  function toggleAssignee(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  const label = value.length === 0
    ? "Sem responsável"
    : value.length === 1
      ? (profiles.find((p) => p.id === value[0])?.full_name ?? "1 responsável")
      : `${value.length} responsáveis`;

  return (
    <div className="relative">
      <button
        type="button"
        ref={btnRef}
        onClick={handleToggle}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm outline-none transition-all",
          "border border-[var(--border)] bg-transparent",
          open && "ring-1 ring-[var(--glass-border)]"
        )}
        style={{ color: "var(--text-title)" }}
      >
        <AssigneeAvatarGroup assigneeIds={value} size={20} />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown size={13} className={cn("flex-shrink-0 transition-transform", open && "rotate-180")} style={{ color: "var(--muted-foreground)" }} />
      </button>

      {mounted && createPortal(
        <>
          {open && (
            <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          )}
          <AnimatePresence>
            {open && (
              <motion.div
                key="assignee-dropdown"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, maxHeight: 260, overflowY: "auto" }}
              >
                <div
                  className="rounded-xl py-1 shadow-2xl"
                  style={{
                    background: "var(--bg-tooltip)",
                    border: "1px solid var(--border-tooltip)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                  }}
                >
                  {activeProfiles.length === 0 && (
                    <p className="px-3.5 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>Nenhum usuário disponível</p>
                  )}
                  {activeProfiles.map((p) => {
                    const checked = value.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => toggleAssignee(p.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors",
                          checked ? "bg-[var(--hover)] text-[var(--text-title)]" : "text-[var(--silver)] hover:bg-[var(--hover)] hover:text-[var(--text-title)]"
                        )}
                      >
                        <div
                          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors"
                          style={{
                            borderColor: checked ? "var(--primary)" : "var(--border)",
                            background: checked ? "var(--primary)" : "transparent",
                          }}
                        >
                          {checked && <span className="text-[10px] font-bold" style={{ color: "#000000" }}>✓</span>}
                        </div>
                        <span className="flex-1 truncate font-medium">{p.full_name}</span>
                      </button>
                    );
                  })}
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
