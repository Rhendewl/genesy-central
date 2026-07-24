import type { FormStep } from "@/types";

export function humanizeStoredValue(value: string): string {
  if (!value.includes("_") || value.includes("://") || value.includes("@")) return value;
  return value
    .replace(/,_+/g, ", ")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function choiceLabel(value: unknown, step: FormStep): string | null {
  const choice = step.choices?.find(option => option.value === value || option.id === value);
  return choice?.label ?? null;
}

export function formatSubmissionAnswer(value: unknown, step?: FormStep): string {
  if (value === null || value === undefined || value === "") return "Não respondido";
  if (typeof value === "boolean") return value ? "Sim" : "Não";

  if (Array.isArray(value)) {
    const values = value.map(item => {
      const label = step ? choiceLabel(item, step) : null;
      return label ?? humanizeStoredValue(String(item));
    });
    return values.filter(Boolean).join(", ") || "Não respondido";
  }

  if (step) {
    const label = choiceLabel(value, step);
    if (label) return label;

    if (step.type === "rating") {
      return `${value} de ${step.maxRating ?? 5}`;
    }
    if (step.type === "nps_scale") {
      return `${value} de 10`;
    }
    if (step.type === "date") {
      const date = new Date(String(value));
      if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("pt-BR");
    }
  }

  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return humanizeStoredValue(String(value));
}

export function getNpsPresentation(value: unknown): {
  score: number;
  label: "Detrator" | "Neutro" | "Promotor";
  color: string;
} | null {
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 10) return null;
  if (score <= 6) return { score, label: "Detrator", color: "#ef4444" };
  if (score <= 8) return { score, label: "Neutro", color: "#f59e0b" };
  return { score, label: "Promotor", color: "#22c55e" };
}
