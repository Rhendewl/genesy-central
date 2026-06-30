import type { SubmissionListItem } from "@/lib/respostas/types";

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    const items = val.map(v => (v !== null && v !== undefined ? String(v) : "—"));
    return items.join(", ") || "—";
  }
  if (typeof val === "string") return val || "—";
  return JSON.stringify(val);
}

interface TabRespostasProps {
  submission: SubmissionListItem;
}

export function TabRespostas({ submission }: TabRespostasProps) {
  const entries = Object.entries(submission.answers);

  if (entries.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: "var(--muted-foreground)" }}>
        Nenhuma resposta registrada.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.map(([key, val], i) => (
        <div key={key}>
          <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
            Campo {i + 1}
          </p>
          <p className="text-sm break-words" style={{ color: "var(--text-title)" }}>
            {formatValue(val)}
          </p>
        </div>
      ))}
    </div>
  );
}
