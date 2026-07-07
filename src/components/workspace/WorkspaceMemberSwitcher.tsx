"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { useUsers } from "@/hooks/useUsers";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";

// ─────────────────────────────────────────────────────────────────────────────
// WorkspaceMemberSwitcher — só aparece pra admin. Deixa escolher "Meu
// Workspace" (padrão) ou o Workspace de qualquer colega ativo da equipe —
// mesmo dropdown/portal usado em AccountSelector.tsx (Tráfego).
// ─────────────────────────────────────────────────────────────────────────────

export function WorkspaceMemberSwitcher() {
  const { member } = useCurrentMember();
  const { profiles, isLoading } = useUsers();
  const { viewingMember, setViewingMember } = useWorkspaceViewing();

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  if (member?.role !== "admin") return null;

  const colleagues = profiles.filter((p) => p.auth_user_id && p.auth_user_id !== member.auth_user_id && p.is_active);
  if (isLoading || colleagues.length === 0) return null;

  const label = viewingMember ? viewingMember.full_name : "Meu Workspace";

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen((o) => !o);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className={cn(
          "lc-card flex items-center gap-2 px-3.5 py-2 text-sm transition-all",
          open && "ring-1 ring-[var(--glass-border)]"
        )}
      >
        <Users size={13} style={{ color: viewingMember ? "#e0a344" : "var(--primary)" }} />
        <span className="max-w-[140px] truncate font-medium text-[var(--text-title)]">{label}</span>
        <ChevronDown size={13} className={cn("shrink-0 text-[var(--silver)] transition-transform", open && "rotate-180")} />
      </button>

      {mounted && createPortal(
        <>
          {open && <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />}
          <AnimatePresence>
            {open && (
              <motion.div
                key="workspace-member-dropdown"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, minWidth: 220 }}
              >
                <div
                  className="rounded-xl shadow-2xl"
                  style={{
                    background: "var(--bg-tooltip)",
                    border: "1px solid var(--border-tooltip)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                  }}
                >
                  <button
                    onClick={() => { setViewingMember(null); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors",
                      !viewingMember ? "bg-[var(--hover)] text-[var(--text-title)]" : "text-[var(--silver)] hover:bg-[var(--hover)] hover:text-[var(--text-title)]"
                    )}
                  >
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span className="font-medium">Meu Workspace</span>
                    {!viewingMember && <span className="ml-auto text-xs text-[var(--text-body)]">✓</span>}
                  </button>

                  <div className="mx-3 border-t" style={{ borderColor: "var(--border)" }} />

                  {colleagues.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setViewingMember(p); setOpen(false); }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors",
                        viewingMember?.id === p.id ? "bg-[var(--hover)] text-[var(--text-title)]" : "text-[var(--silver)] hover:bg-[var(--hover)] hover:text-[var(--text-title)]"
                      )}
                    >
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#e0a344" }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium leading-tight">{p.full_name}</p>
                        <p className="truncate text-[10px] text-[var(--text-muted)]">{p.job_title || p.email}</p>
                      </div>
                      {viewingMember?.id === p.id && <span className="ml-auto shrink-0 text-xs text-[var(--text-body)]">✓</span>}
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
