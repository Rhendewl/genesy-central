import { BSC_PERSPECTIVES } from "./bsc";
const horizons = ["curto", "medio", "longo"];
const statuses = [
  "planejado",
  "em_andamento",
  "pausado",
  "concluido",
  "cancelado",
];
const priorities = ["baixa", "media", "alta", "urgente"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateTagIds(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every((id) => typeof id === "string" && uuid.test(id))
  );
}
export function validateObjectiveInput(
  input: unknown,
  creating = false,
): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return "Corpo inválido";
  const body = input as Record<string, unknown>;
  if (
    (creating || "title" in body) &&
    (typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.length > 500)
  )
    return "Informe um título de até 500 caracteres";
  for (const [key, values] of [
    ["horizon", horizons],
    ["status", statuses],
    ["priority", priorities],
  ] as const)
    if (key in body && !values.includes(body[key] as string))
      return `Valor inválido: ${key}`;
  if (body.perspective != null && !Object.keys(BSC_PERSPECTIVES).includes(body.perspective as string))
    return "Perspectiva BSC inválida";
  for (const key of ["parent_id", "assignee_id", "user_id"])
    if (
      body[key] != null &&
      (typeof body[key] !== "string" || !uuid.test(body[key] as string))
    )
      return `Identificador inválido: ${key}`;
  for (const key of ["assignee_ids", "tags"])
    if (key in body && !validateTagIds(body[key]))
      return `Seleção inválida: ${key}`;
  for (const key of ["start_date", "due_date"])
    if (body[key] != null) {
      const value = body[key];
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value
      )
        return "Data inválida";
    }
  if (body.description != null && typeof body.description !== "string")
    return "Descrição inválida";
  return null;
}
