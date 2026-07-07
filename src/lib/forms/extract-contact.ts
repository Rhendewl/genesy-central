import type { FormStep } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// extractContactFromAnswers — escaneia steps+answers de um formulário por
// step.type para achar nome/telefone/e-mail do respondente, sem pedir de novo.
//
// Extraído de createCrmLead() (src/app/api/form/[slug]/resposta/route.ts) para
// ser reutilizado também pelo bloco Calendário (que precisa desses dados para
// criar o agendamento sem repetir um formulário de "seus dados").
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedContact {
  name:  string | null;
  phone: string | null;
  email: string | null;
  /** ids dos steps cujo valor foi consumido como nome/telefone/e-mail — usado
   *  por quem monta notas/observações a partir das respostas restantes, para
   *  não repetir o mesmo campo que já virou nome/telefone/e-mail. */
  consumedStepIds: string[];
}

export function extractContactFromAnswers(
  steps:   FormStep[],
  answers: Record<string, unknown>,
): ExtractedContact {
  let name:  string | null = null;
  let phone: string | null = null;
  let email: string | null = null;
  const consumedStepIds: string[] = [];

  for (const step of steps) {
    const answer = answers[step.id];
    if (answer === undefined || answer === null || answer === "") continue;

    const val = Array.isArray(answer) ? answer.join(", ") : String(answer);

    if (step.type === "email" && !email) {
      email = val;
      consumedStepIds.push(step.id);
      continue;
    }
    if (step.type === "phone" && !phone) {
      phone = val;
      consumedStepIds.push(step.id);
      continue;
    }
    if (step.type === "name" && !name) {
      name = val;
      consumedStepIds.push(step.id);
      continue;
    }
    if ((step.type === "short_text" || step.type === "long_text") && !name && /nome/i.test(step.title)) {
      name = val;
      consumedStepIds.push(step.id);
      continue;
    }
  }

  // Fallback: primeiro short_text como nome
  if (!name) {
    const firstText = steps.find(s => s.type === "short_text");
    if (firstText && answers[firstText.id]) {
      name = String(answers[firstText.id]);
      consumedStepIds.push(firstText.id);
    }
  }

  return { name, phone, email, consumedStepIds };
}
