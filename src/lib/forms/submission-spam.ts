import type { FormStep } from "@/types";
import { extractContactFromAnswers } from "./extract-contact";

export type SubmissionSpamReason = "honeypot" | "known_synthetic_contact";

function normalizeText(value: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Detecta apenas sinais de alta confiança. O nome nunca é bloqueado sozinho:
 * a assinatura sintética exige também o telefone sequencial usado pelos robôs
 * e um formulário com respostas suficientes para evitar falso positivo.
 */
export function detectSubmissionSpam(input: {
  steps: FormStep[];
  answers: Record<string, unknown>;
  website?: unknown;
}): SubmissionSpamReason | null {
  if (typeof input.website === "string" && input.website.trim()) return "honeypot";

  const { name, phone } = extractContactFromAnswers(input.steps, input.answers);
  const normalizedName = normalizeText(name);
  const phoneDigits = (phone ?? "").replace(/\D/g, "");

  if (
    Object.keys(input.answers).length >= 3 &&
    normalizedName === "joao silva" &&
    phoneDigits.endsWith("987654321")
  ) {
    return "known_synthetic_contact";
  }

  return null;
}
