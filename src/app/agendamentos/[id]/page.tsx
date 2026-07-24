"use client";

import { useState } from "react";
import { useRouter }  from "next/navigation";
import { motion }     from "framer-motion";
import { ArrowLeft, Loader2, CalendarX } from "lucide-react";
import { Header }             from "@/components/layout/Header";
import { BasicInfoTab }        from "@/components/appointments/BasicInfoTab";
import { HorariosTab }         from "@/components/appointments/HorariosTab";
import { ExceptionsTab }       from "@/components/appointments/ExceptionsTab";
import { PaginaPublicaTab }    from "@/components/appointments/PaginaPublicaTab";
import { NotificacoesTab }     from "@/components/appointments/NotificacoesTab";
import { useCalendar }         from "@/hooks/useCalendar";

// ── Tab definition ────────────────────────────────────────────────────────────

type TabId = "basico" | "horarios" | "excecoes" | "notificacoes" | "pagina-publica" | "analytics";

interface TabDef {
  id:    TabId;
  label: string;
  soon?: boolean;
}

const TABS: TabDef[] = [
  { id: "basico",         label: "Básico" },
  { id: "horarios",       label: "Horários" },
  { id: "excecoes",       label: "Exceções" },
  { id: "pagina-publica", label: "Página Pública" },
  { id: "notificacoes",   label: "Notificações" },
  { id: "analytics",      label: "Analytics",   soon: true },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CalendarDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id }  = params;
  const router  = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("basico");
  const [isSavingRules, setIsSavingRules] = useState(false);

  const {
    calendar, rules, exceptions,
    isLoading, error,
    updateCalendar, upsertRules, createException, deleteException, getSlots,
  } = useCalendar(id);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col" style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
        <Header title="Calendário" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      </div>
    );
  }

  if (error || !calendar) {
    return (
      <div className="flex min-h-dvh flex-col" style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
        <Header title="Calendário" />
        <div className="flex-1 flex items-center justify-center flex-col gap-3">
          <CalendarX size={32} style={{ color: "var(--muted-foreground)" }} />
          <p style={{ color: "var(--muted-foreground)" }}>{error ?? "Calendário não encontrado"}</p>
          <button
            onClick={() => router.push("/agendamentos")}
            className="text-sm underline"
            style={{ color: "var(--muted-foreground)" }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const handleSaveRules = async (newRules: Parameters<typeof upsertRules>[0]) => {
    setIsSavingRules(true);
    await upsertRules(newRules);
    setIsSavingRules(false);
  };

  return (
    <div className="flex min-h-dvh flex-col pb-24" style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
      {/* Back nav */}
      <div className="px-4 sm:px-6 pt-4 pb-0">
        <button
          onClick={() => router.push("/agendamentos")}
          className="flex items-center gap-1.5 text-sm mb-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft size={14} />
          Agendamentos
        </button>
      </div>

      <Header
        title={calendar.name}
        subtitle={calendar.description ?? undefined}
      />

      {/* Status badge */}
      <div className="px-4 sm:px-6 pb-3">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            background: calendar.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.08)",
            color:      calendar.status === "active" ? "#22c55e" : "rgba(255,255,255,0.35)",
          }}
        >
          {calendar.status === "active" ? "Ativo" : "Arquivado"}
        </span>
      </div>

      {/* Tab bar */}
      <div
        className="px-4 sm:px-6 flex items-center gap-0.5 border-b overflow-x-auto scrollbar-none"
        style={{ borderColor: "var(--border)" }}
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => !tab.soon && setActiveTab(tab.id)}
            disabled={tab.soon}
            className="relative px-3 py-2.5 text-sm font-medium transition-colors shrink-0 disabled:cursor-default"
            style={{
              color: tab.soon
                ? "rgba(255,255,255,0.25)"
                : activeTab === tab.id
                  ? "var(--text-title)"
                  : "var(--muted-foreground)",
            }}
          >
            {tab.label}
            {tab.soon && (
              <span
                className="ml-1.5 text-xs px-1 py-0.5 rounded font-normal"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}
              >
                Em breve
              </span>
            )}
            {!tab.soon && activeTab === tab.id && (
              <motion.span
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                style={{ background: "var(--primary)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 sm:px-6 pt-6">
        {activeTab === "basico" && (
          <BasicInfoTab
            calendar={calendar}
            onSave={updateCalendar}
          />
        )}

        {activeTab === "horarios" && (
          <HorariosTab
            rules={rules}
            isSaving={isSavingRules}
            calendarId={calendar.id}
            timezone={calendar.timezone}
            onSave={handleSaveRules}
            getSlots={getSlots}
          />
        )}

        {activeTab === "excecoes" && (
          <ExceptionsTab
            exceptions={exceptions}
            onCreate={createException}
            onDelete={deleteException}
          />
        )}

        {activeTab === "pagina-publica" && (
          <PaginaPublicaTab
            calendar={calendar}
            onSave={updateCalendar}
          />
        )}

        {activeTab === "notificacoes" && (
          <NotificacoesTab
            calendar={calendar}
            onSave={updateCalendar}
          />
        )}
      </div>
    </div>
  );
}
