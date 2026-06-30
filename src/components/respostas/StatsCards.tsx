import { Card, CardContent } from "@/components/ui/card";
import type { SubmissionStats } from "@/lib/respostas/types";

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

const ITEMS = [
  { key: "total",          label: "Total"      },
  { key: "completed",      label: "Completos"  },
  { key: "abandoned",      label: "Abandonados"},
  { key: "completionRate", label: "Conclusão"  },
] as const;

interface StatsCardsProps {
  stats: SubmissionStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {ITEMS.map(({ key, label }) => {
        const raw   = stats[key];
        const value = key === "completionRate" ? fmtPct(raw) : String(raw);
        return (
          <Card key={key} size="sm">
            <CardContent>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
                {label}
              </p>
              <p className="text-2xl font-bold" style={{ color: "var(--text-title)" }}>
                {value}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
