import type { InstagramAutomationInput } from "./types";
import { validateInstagramSequence } from "./matching";

export function sanitizeInstagramAutomationInput(body: Partial<InstagramAutomationInput>) {
  const steps = Array.isArray(body.steps) ? body.steps.map(step => ({
    type: "message" as const,
    text: String(step.text ?? "").trim(),
    delayMinutes: Math.round(Number(step.delayMinutes ?? 0)),
  })) : [];
  const input: InstagramAutomationInput = {
    connectionId: String(body.connectionId ?? ""),
    name: String(body.name ?? "").trim().slice(0, 120),
    status: ["draft", "active", "paused"].includes(String(body.status)) ? body.status! : "draft",
    triggerType: ["comment", "message", "story_reply", "postback"].includes(String(body.triggerType)) ? body.triggerType! : "comment",
    matchType: ["contains", "exact", "starts_with", "any"].includes(String(body.matchType)) ? body.matchType! : "contains",
    keywords: Array.from(new Set((Array.isArray(body.keywords) ? body.keywords : []).map(value => String(value).trim().slice(0, 120)).filter(Boolean))).slice(0, 50),
    publicReplyText: String(body.publicReplyText ?? "").trim().slice(0, 1000) || null,
    steps,
    crmEnabled: body.crmEnabled === true,
    crmPipelineId: body.crmPipelineId || null,
    crmStageId: body.crmStageId || null,
  };
  if (!input.connectionId || !input.name) throw Object.assign(new Error("Conta e nome são obrigatórios"), { status: 400 });
  if (input.matchType !== "any" && !input.keywords.length) throw Object.assign(new Error("Informe ao menos uma palavra ou frase"), { status: 400 });
  if (input.triggerType !== "comment") input.publicReplyText = null;
  const sequenceError = validateInstagramSequence(input);
  if (sequenceError) throw Object.assign(new Error(sequenceError), { status: 400 });
  if (input.crmEnabled && (!input.crmPipelineId || !input.crmStageId)) {
    throw Object.assign(new Error("Selecione a pipeline e a etapa do CRM"), { status: 400 });
  }
  return input;
}
