"use client";

import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { useLeads } from "@/hooks/useLeads";
import { useGreeting } from "@/hooks/useGreeting";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { AgendaSemanalPanel } from "@/components/agenda/AgendaSemanalPanel";
import { MyDayCard } from "@/components/dashboard-geral/MyDayCard";
import { CrmFunnelPanel } from "@/components/dashboard-geral/CrmFunnelPanel";
import { WorkspaceSummaryPanel } from "@/components/dashboard-geral/WorkspaceSummaryPanel";
import { TrafegoSummaryCard } from "@/components/dashboard-geral/TrafegoSummaryCard";
import { FinanceiroSummaryCard } from "@/components/dashboard-geral/FinanceiroSummaryCard";
import { NotesSummaryCard } from "@/components/dashboard-geral/NotesSummaryCard";
import { DashboardHeaderActions } from "@/components/dashboard-geral/DashboardHeaderActions";

// ─────────────────────────────────────────────────────────────────────────────
// Alturas fixas — nenhum card cresce com o conteúdo, tudo com scroll interno.
// Valores iniciais, ajustáveis após checagem visual.
// ─────────────────────────────────────────────────────────────────────────────
const CARD_H_ATTENTION      = 228;
const CARD_H_TRAFEGO_FIN    = 220;
const CARD_H_WORKSPACE      = 216;
const CARD_H_AGENDA         = 360;
const CARD_H_FUNNEL         = 350;
const CARD_H_NOTES          = 214;

// ─────────────────────────────────────────────────────────────────────────────
// DashboardPage — Centro de Comando
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { greeting, name, isLoading: greetingLoading } = useGreeting();
  const { member, isLoading: memberLoading } = useCurrentMember();

  // Enquanto o perfil ainda carrega, nenhum widget condicionado por papel é
  // exibido — evita o flash de mostrar e depois esconder um card.
  const canSee = (key: string) => !memberLoading && (member?.permissions.includes(key) ?? false);
  const showCrm       = canSee("crm");
  const showTrafego   = canSee("trafego");
  const showFinanceiro = canSee("financeiro");

  const { leads } = useLeads();

  const now = new Date();

  // Hook do Workspace instanciado uma única vez aqui e compartilhado entre
  // MyDayCard e WorkspaceSummaryPanel — evita fetch/canal realtime duplicado.
  const tasksHook = useWorkspaceTasks();

  const todayKey = now.toISOString().slice(0, 10);

  // Funil CRM — sempre escopado ao mês atual (leads.entered_at)
  const monthKey = todayKey.slice(0, 7); // "yyyy-MM"
  const leadsDoMes = leads.filter((l) => l.entered_at?.slice(0, 7) === monthKey);
  const funnelCounts = {
    totalLeads: leadsDoMes.length,
    agendadas:  leadsDoMes.filter((l) => l.kanban_column === "reuniao_agendada").length,
    realizadas: leadsDoMes.filter((l) => l.kanban_column === "reuniao_realizada").length,
    noShow:     leadsDoMes.filter((l) => l.kanban_column === "no_show").length,
    vendas:     leadsDoMes.filter((l) => l.kanban_column === "venda_realizada").length,
  };

  return (
    <div className="dashboard-geral-bg">
      <div className="mx-auto max-w-7xl space-y-4 px-4 pb-6 sm:px-6">
        <Header
          title={greetingLoading ? "Olá" : name ? `${greeting}, ${name}` : greeting}
          actions={<DashboardHeaderActions tasksHook={tasksHook} name={name} avatarUrl={member?.avatar_url ?? null} />}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          {/* ── Coluna esquerda ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <MyDayCard
              tasksHook={tasksHook}
              leads={showCrm ? leads : []}
              financeiroEnabled={showFinanceiro}
              height={CARD_H_ATTENTION}
              delay={0}
            />
            <WorkspaceSummaryPanel tasksHook={tasksHook} height={CARD_H_WORKSPACE} delay={0.04} />
            {showCrm && (
              <CrmFunnelPanel
                totalLeads={funnelCounts.totalLeads}
                agendadas={funnelCounts.agendadas}
                realizadas={funnelCounts.realizadas}
                noShow={funnelCounts.noShow}
                vendas={funnelCounts.vendas}
                height={CARD_H_FUNNEL}
                delay={0.08}
              />
            )}
          </div>

          {/* ── Coluna direita ───────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {/* Linha 1: Calendário */}
            <motion.div
              className="lc-card flex flex-col overflow-hidden p-5"
              style={{ background: "rgba(0,0,0,0.31)", height: CARD_H_AGENDA }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
            >
              <AgendaSemanalPanel />
            </motion.div>

            {/* Linha 2: Tráfego | Financeiro — colapsa conforme a permissão do usuário */}
            {(showTrafego || showFinanceiro) && (
              <div className={`grid grid-cols-1 gap-4 ${showTrafego && showFinanceiro ? "lg:grid-cols-2" : ""}`}>
                {showTrafego && (
                  <TrafegoSummaryCard year={now.getFullYear()} month={now.getMonth() + 1} height={CARD_H_TRAFEGO_FIN} delay={0.12} />
                )}
                {showFinanceiro && (
                  <FinanceiroSummaryCard year={now.getFullYear()} month={now.getMonth() + 1} height={CARD_H_TRAFEGO_FIN} delay={0.16} />
                )}
              </div>
            )}

            {/* Linha 3: Notas */}
            <NotesSummaryCard height={CARD_H_NOTES} delay={0.2} />
          </div>
        </div>
      </div>
    </div>
  );
}
