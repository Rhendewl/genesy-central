import { AlertTriangle, CheckCircle2, Info, MapPin, Target, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiGuidanceStatus = "good" | "attention" | "critical" | "info";

export interface KpiGuidanceItem {
  id: string;
  status: KpiGuidanceStatus;
  title: string;
  signal: string;
  diagnosis: string;
  action: string;
}

const STATUS = {
  good: {
    label: "Bom",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-300",
    badge: "border-emerald-500/25 bg-emerald-500/10",
    glow: "#10b981",
  },
  attention: {
    label: "Atenção",
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-300",
    badge: "border-amber-500/25 bg-amber-500/10",
    glow: "#f59e0b",
  },
  critical: {
    label: "Ruim",
    icon: XCircle,
    color: "text-rose-600 dark:text-rose-300",
    badge: "border-rose-500/25 bg-rose-500/10",
    glow: "#f43f5e",
  },
  info: {
    label: "Observe",
    icon: Info,
    color: "text-blue-600 dark:text-blue-300",
    badge: "border-blue-500/25 bg-blue-500/10",
    glow: "#3b82f6",
  },
} as const;

export function KpiReadingGuide({
  items,
  title = "Como ler estes KPIs",
  description = "O placar mostra o resultado. Este guia indica onde procurar a causa e qual deve ser o próximo movimento.",
  className,
}: {
  items: KpiGuidanceItem[];
  title?: string;
  description?: string;
  className?: string;
}) {
  if (!items.length) return null;

  const good = items.filter((item) => item.status === "good").length;
  const warnings = items.filter((item) => item.status === "attention" || item.status === "critical").length;

  return (
    <section className={cn("relative overflow-hidden rounded-2xl border p-4 sm:p-5", className)} style={{ background: "var(--glass-bg-soft)" }}>
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--primary)]">Leitura orientada</p>
          <h2 className="mt-1 text-sm font-semibold text-[var(--text-title)]">{title}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted-foreground)]">{description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {good > 0 && <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">{good} positivo{good > 1 ? "s" : ""}</span>}
          {warnings > 0 && <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-600 dark:text-amber-300">{warnings} ponto{warnings > 1 ? "s" : ""} de atenção</span>}
        </div>
      </div>

      <div className="relative grid gap-3 lg:grid-cols-2">
        {items.map((item) => {
          const config = STATUS[item.status];
          const Icon = config.icon;
          return (
            <article key={item.id} className="relative overflow-hidden rounded-xl border p-4" style={{ background: "var(--bg-modal)" }}>
              <span className="absolute inset-y-0 left-0 w-0.5" style={{ background: config.glow }} />
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border", config.badge, config.color)}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-title)]">{item.title}</h3>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide", config.badge, config.color)}>{config.label}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-body)]">{item.signal}</p>
                  <div className="mt-3 grid gap-2 text-[11px] leading-[18px] sm:grid-cols-2">
                    <div className="rounded-lg bg-[var(--hover)] p-2.5">
                      <p className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--text-title)]"><MapPin size={12} className="text-[var(--muted-foreground)]" /> Onde olhar</p>
                      <p className="text-[var(--muted-foreground)]">{item.diagnosis}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--hover)] p-2.5">
                      <p className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--text-title)]"><Target size={12} className="text-[var(--muted-foreground)]" /> Próxima ação</p>
                      <p className="text-[var(--muted-foreground)]">{item.action}</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
