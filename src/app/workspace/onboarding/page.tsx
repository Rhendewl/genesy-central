"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Rocket, Search } from "lucide-react";
import { toast } from "sonner";
import { OnboardingSubNav } from "@/components/workspace/onboarding/OnboardingSubNav";
import { OnboardingProjectCard } from "@/components/workspace/onboarding/OnboardingProjectCard";
import { NewOnboardingWizard } from "@/components/workspace/onboarding/NewOnboardingWizard";
import { useOnboardingProjects } from "@/hooks/useOnboardingProjects";
import { ONBOARDING_PROJECT_STATUSES, type OnboardingProjectStatus } from "@/types/onboarding";

export default function OnboardingDashboardPage() {
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OnboardingProjectStatus | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { projects, isLoading, createProject } = useOnboardingProjects({ search, mine });
  const filtered = statusFilter ? projects.filter((p) => p.status === statusFilter) : projects;

  return (
    <div className="flex flex-col pb-24">
      <OnboardingSubNav />

      <div className="flex flex-col gap-3 px-4 pb-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Onboardings</h1>
          <motion.button
            onClick={() => setWizardOpen(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="lc-btn flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            Novo Onboarding
          </motion.button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
            <Search size={14} style={{ color: "var(--muted-foreground)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
              style={{ color: "var(--text-title)" }}
            />
          </div>
          <button
            onClick={() => setMine((v) => !v)}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: mine ? "var(--accent-blue)30" : "var(--hover)",
              color:      mine ? "var(--accent-blue)" : "var(--muted-foreground)",
              border:     `1px solid ${mine ? "var(--accent-blue)50" : "var(--glass-border)"}`,
            }}
          >
            Meus onboardings
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter(null)}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              background: !statusFilter ? "var(--hover)" : "transparent",
              color:      !statusFilter ? "var(--text-title)" : "var(--muted-foreground)",
              border:     "1px solid var(--glass-border)",
            }}
          >
            Todos
          </button>
          {ONBOARDING_PROJECT_STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(statusFilter === s.id ? null : s.id)}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
              style={{
                background: statusFilter === s.id ? `${s.color}30` : "transparent",
                color:      statusFilter === s.id ? s.color : "var(--muted-foreground)",
                border:     `1px solid ${statusFilter === s.id ? s.color + "50" : "var(--glass-border)"}`,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Rocket size={28} style={{ color: "var(--muted-foreground)" }} />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum onboarding encontrado</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Clique em &quot;Novo Onboarding&quot; para iniciar a implantação de um cliente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => <OnboardingProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>

      {wizardOpen && (
        <NewOnboardingWizard
          onClose={() => setWizardOpen(false)}
          onCreate={async (data) => {
            const result = await createProject(data);
            if (result.error) toast.error(result.error);
            return result;
          }}
        />
      )}
    </div>
  );
}
