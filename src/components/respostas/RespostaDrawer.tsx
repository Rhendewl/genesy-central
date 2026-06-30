"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Clock, Zap, Loader2, Star, Archive } from "lucide-react";
import { useRespostaDetail } from "@/hooks/useRespostaDetail";
import type { SubmissionListItem } from "@/lib/respostas/types";
import { SubmissionStatusBadge } from "./SubmissionStatusBadge";
import { TabRespostas }    from "./TabRespostas";
import { TabTimeline }     from "./TabTimeline";
import { TabIntegracoes }  from "./TabIntegracoes";

type Tab = "respostas" | "timeline" | "integracoes";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "respostas",    label: "Respostas",   icon: FileText },
  { id: "timeline",    label: "Timeline",    icon: Clock    },
  { id: "integracoes", label: "Integrações", icon: Zap      },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface RespostaDrawerProps {
  submissionId:      string | null;
  selectedSubmission?: SubmissionListItem | null;
  open:              boolean;
  onClose:           () => void;
  onMarkRead?:       () => void;
  onToggleStarred?:  (starred: boolean) => Promise<boolean> | void;
  onArchive?:        () => void;
}

export function RespostaDrawer({
  submissionId,
  selectedSubmission,
  open,
  onClose,
  onMarkRead,
  onToggleStarred,
  onArchive,
}: RespostaDrawerProps) {
  const [activeTab,  setActiveTab]  = useState<Tab>("respostas");
  const [isStarring, setIsStarring] = useState(false);

  // Reset tab and in-flight star state when switching submissions
  useEffect(() => {
    setActiveTab("respostas");
    setIsStarring(false);
  }, [submissionId]);

  const { detail, isLoading, error } = useRespostaDetail(submissionId);

  // Guard: call onMarkRead at most once per open session per submission
  const hasMarkedRef = useRef(false);

  useEffect(() => {
    hasMarkedRef.current = false;
  }, [submissionId]);

  useEffect(() => {
    if (!open || !detail || hasMarkedRef.current) return;
    if (detail.submission.id !== submissionId) return;
    if (detail.submission.read_at !== null) return;
    hasMarkedRef.current = true;
    onMarkRead?.();
  }, [open, detail, submissionId, onMarkRead]);

  const starred  = selectedSubmission?.starred  ?? detail?.submission.starred  ?? false;
  const archived = selectedSubmission?.archived ?? detail?.submission.archived ?? false;

  const handleStar = async () => {
    if (isStarring) return;
    setIsStarring(true);
    try {
      await onToggleStarred?.(!starred);
    } finally {
      setIsStarring(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="relative z-10 w-full max-w-xl flex flex-col h-full overflow-hidden"
            style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between px-5 py-4 shrink-0 gap-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold truncate" style={{ color: "var(--text-title)" }}>
                  {detail?.submission.form_name ?? "Resposta"}
                </h2>
                {detail && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <SubmissionStatusBadge status={detail.submission.status} />
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {formatDate(detail.submission.created_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 shrink-0">
                {detail && (
                  <>
                    {/* Star toggle */}
                    <button
                      onClick={handleStar}
                      disabled={isStarring}
                      title={starred ? "Remover favorito" : "Favoritar"}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <Star
                        size={16}
                        fill={starred ? "currentColor" : "none"}
                        style={{ color: starred ? "#f59e0b" : "var(--muted-foreground)" }}
                      />
                    </button>

                    {/* Archive — only when not yet archived */}
                    {!archived && (
                      <button
                        onClick={() => onArchive?.()}
                        title="Arquivar"
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <Archive size={16} style={{ color: "var(--muted-foreground)" }} />
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={16} style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div
              className="flex items-center gap-0.5 px-4 py-2 shrink-0 overflow-x-auto"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                    style={{
                      background: isActive ? "var(--primary)" : "transparent",
                      color:      isActive ? "#fff" : "var(--muted-foreground)",
                    }}
                  >
                    <tab.icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">
              {isLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
                </div>
              )}

              {!isLoading && error && (
                <p className="text-sm py-8" style={{ color: "#ef4444" }}>{error}</p>
              )}

              {!isLoading && detail && (
                <>
                  {activeTab === "respostas"   && <TabRespostas   submission={detail.submission} />}
                  {activeTab === "timeline"    && <TabTimeline    events={detail.sessionEvents} />}
                  {activeTab === "integracoes" && <TabIntegracoes deliveries={detail.integrationDeliveries} />}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
