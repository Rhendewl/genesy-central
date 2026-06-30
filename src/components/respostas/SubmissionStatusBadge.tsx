import { Badge } from "@/components/ui/badge";
import type { SubmissionStatus } from "@/lib/respostas/types";

const STATUS_MAP: Record<SubmissionStatus, { label: string; className: string }> = {
  completed: { label: "Completo",   className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  partial:   { label: "Parcial",    className: "bg-amber-500/10  text-amber-400  border-amber-500/20"  },
  started:   { label: "Iniciado",   className: "bg-blue-500/10   text-blue-400   border-blue-500/20"   },
  abandoned: { label: "Abandonado", className: "bg-red-500/10    text-red-400    border-red-500/20"    },
  spam:      { label: "Spam",       className: "bg-gray-500/10   text-gray-400   border-gray-500/20"   },
};

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus;
}

export function SubmissionStatusBadge({ status }: SubmissionStatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.partial;
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
