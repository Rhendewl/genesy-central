import { BSC_PERSPECTIVES, type BscPerspective } from "./bsc";
import { validateObjectiveInput, validateTagIds } from "./objective-validation";
export type BscAreaDraft = {
  perspective: BscPerspective;
  description: string;
  indicator: string;
  unit: string;
  baseline: string;
  target: string;
  current_value: string;
  tasks: string;
  task_ids: string[];
  assignee_ids: string[];
};
export type BscDraft = {
  title: string;
  horizon: "curto" | "medio" | "longo";
  priority: "baixa" | "media" | "alta" | "urgente";
  start_date: string;
  due_date: string;
  tags: string[];
  areas: BscAreaDraft[];
};
export function newBscDraft(): BscDraft {
  return {
    title: "",
    horizon: "medio",
    priority: "media",
    start_date: "",
    due_date: "",
    tags: [],
    areas: Object.keys(BSC_PERSPECTIVES).map((perspective) => ({
      perspective: perspective as BscPerspective,
      description: "",
      indicator: "",
      unit: "",
      baseline: "0",
      target: "",
      current_value: "0",
      tasks: "",
      task_ids: [],
      assignee_ids: [],
    })),
  };
}
export function validateBscDraft(input: unknown): string | null {
  if (!input || typeof input !== "object") return "Cadastro inválido";
  const d = input as BscDraft;
  const basic = validateObjectiveInput(
    { ...d, start_date: d.start_date || null, due_date: d.due_date || null },
    true,
  );
  if (basic) return basic;
  if (d.start_date && d.due_date && d.start_date > d.due_date)
    return "O término deve ser posterior ao início";
  if (
    !Array.isArray(d.areas) ||
    d.areas.length !== 4 ||
    new Set(d.areas.map((a) => a?.perspective)).size !== 4
  )
    return "Preencha as quatro áreas do BSC";
  for (const a of d.areas) {
    if (!a || !Object.keys(BSC_PERSPECTIVES).includes(a.perspective))
      return "Área inválida";
    if (typeof a.description !== "string" || a.description.length > 10000)
      return "Descrição inválida";
    if (
      typeof a.indicator !== "string" ||
      !a.indicator.trim() ||
      a.indicator.length > 200
    )
      return "Informe o indicador de cada área";
    if (typeof a.unit !== "string" || !a.unit.trim() || a.unit.length > 50)
      return "Informe a unidade do indicador";
    if (
      [a.baseline, a.target, a.current_value].some(
        (v) =>
          typeof v !== "string" || !v.trim() || !Number.isFinite(Number(v)),
      )
    )
      return "Informe valores numéricos válidos";
    if (Number(a.baseline) === Number(a.target))
      return "A meta deve ser diferente do valor inicial";
    if (
      typeof a.tasks !== "string" ||
      a.tasks.length > 20000 ||
      a.tasks.split("\n").filter((v) => v.trim()).length > 30 ||
      a.tasks.split("\n").some((v) => v.length > 500)
    )
      return "Use até 30 tarefas de até 500 caracteres por área";
    if (!validateTagIds(a.assignee_ids) || !validateTagIds(a.task_ids))
      return "Seleção de tarefas ou responsáveis inválida";
  }
  return null;
}
