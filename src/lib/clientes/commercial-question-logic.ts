import { adaptLegacyRule, createLogicEngine } from "@/lib/logic-engine";
import type { FormStep, LogicRule } from "@/types";

function buildEngine(questions: FormStep[], rules: LogicRule[]) {
  return createLogicEngine({
    steps: questions.map((question) => ({
      id: question.id,
      type: question.type,
      required: question.required,
    })),
    rules: rules.map(adaptLegacyRule),
  }, { strictMode: true });
}

export function nextCommercialQuestionIndex(
  questions: FormStep[],
  rules: LogicRule[],
  currentIndex: number,
  answers: Record<string, unknown>,
) {
  const current = questions[currentIndex];
  if (!current) return -1;
  const result = buildEngine(questions, rules).evaluate({ currentStepId: current.id, answers });
  if (result.type === "next_step") {
    const targetIndex = questions.findIndex((question) => question.id === result.stepId);
    if (targetIndex >= 0) return targetIndex;
  }
  return currentIndex + 1 < questions.length ? currentIndex + 1 : -1;
}

export function commercialQuestionPath(
  questions: FormStep[],
  rules: LogicRule[],
  answers: Record<string, unknown>,
) {
  if (!questions.length) return [];
  const path: FormStep[] = [];
  const visited = new Set<string>();
  let index = 0;

  while (index >= 0 && index < questions.length && path.length <= questions.length) {
    const question = questions[index];
    if (visited.has(question.id)) break;
    visited.add(question.id);
    path.push(question);
    index = nextCommercialQuestionIndex(questions, rules, index, answers);
  }

  return path;
}

export function validateCommercialLogicRules(questions: FormStep[], rules: LogicRule[]) {
  const questionIds = new Set(questions.map((question) => question.id));
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const rule of rules) {
    if (ids.has(rule.id)) errors.push("Há regras de lógica duplicadas.");
    ids.add(rule.id);
    if (!questionIds.has(rule.condition.step)) errors.push("Uma regra pertence a uma pergunta removida.");
    if (rule.action.type !== "jump" || !rule.action.target || !questionIds.has(rule.action.target)) {
      errors.push("Toda regra precisa direcionar para uma pergunta existente.");
    }
    const sourceIndex = questions.findIndex((question) => question.id === rule.condition.step);
    const targetIndex = questions.findIndex((question) => question.id === rule.action.target);
    if (sourceIndex >= 0 && targetIndex >= 0 && targetIndex <= sourceIndex) {
      errors.push("A lógica só pode direcionar para uma pergunta posterior.");
    }
    const source = questions[sourceIndex];
    const allowedValues = source?.type === "rating"
      ? Array.from({ length: source.maxRating === 10 ? 11 : source.maxRating ?? 5 }, (_, index) => source.maxRating === 10 ? index : index + 1)
      : source?.choices?.map((choice) => choice.value) ?? [];
    if (!source || !["rating", "single_choice", "multiple_choice"].includes(source.type) || !allowedValues.some((value) => value === rule.condition.value)) {
      errors.push("Uma regra usa uma resposta que não existe mais.");
    }
  }

  const engine = buildEngine(questions, rules);
  if (engine.validationErrors.some((error) => error.code === "CYCLE_DETECTED")) {
    errors.push("A lógica cria um ciclo entre perguntas. Revise os direcionamentos.");
  }

  return Array.from(new Set(errors));
}
