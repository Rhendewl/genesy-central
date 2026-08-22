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
    crmOriginId: body.crmOriginId || null,
    crmAssignedTo: body.crmAssignedTo || null,
    crmDealValue: Math.max(0, Number(body.crmDealValue ?? 0) || 0),
  };
  if (!input.connectionId || !input.name) throw Object.assign(new Error("Conta e nome são obrigatórios"), { status: 400 });
  if (input.matchType !== "any" && !input.keywords.length) throw Object.assign(new Error("Informe ao menos uma palavra ou frase"), { status: 400 });
  if (input.status === "active" && input.triggerType === "comment" && input.matchType === "any") {
    throw Object.assign(new Error("Para reduzir risco de spam, comentários ativos exigem uma palavra ou frase específica"), { status: 400 });
  }
  if (input.triggerType !== "comment") input.publicReplyText = null;
  const sequenceError = validateInstagramSequence(input);
  if (sequenceError) throw Object.assign(new Error(sequenceError), { status: 400 });
  if (input.crmEnabled && (!input.crmPipelineId || !input.crmStageId)) {
    throw Object.assign(new Error("Selecione a pipeline e a etapa do CRM"), { status: 400 });
  }
  if ((input.crmDealValue ?? 0) > 999_999_999_999) throw Object.assign(new Error("Valor do negócio inválido"), { status: 400 });
  return input;
}

export function assertInstagramConnectionReady(input: InstagramAutomationInput, connection: {
  status?: string | null;
  webhook_subscribed?: boolean | null;
  webhook_fields?: string[] | null;
  requested_scopes?: string[] | null;
}) {
  if (input.status !== "active") return;
  if (connection.status !== "connected") {
    throw Object.assign(new Error("Reconecte a conta do Instagram antes de ativar a automação"), { status: 400 });
  }
  if (!connection.webhook_subscribed) {
    throw Object.assign(new Error("Assine e valide os webhooks do Instagram antes de ativar a automação"), { status: 400 });
  }
  const scopes = new Set(connection.requested_scopes ?? []);
  const fields = new Set(connection.webhook_fields ?? []);
  const requiredScopes = input.triggerType === "comment"
    ? ["instagram_business_basic", "instagram_business_manage_comments", "instagram_business_manage_messages"]
    : ["instagram_business_basic", "instagram_business_manage_messages"];
  const requiredFields = input.triggerType === "comment"
    ? ["comments"]
    : input.triggerType === "postback" ? ["messaging_postbacks"] : ["messages"];
  if (requiredScopes.some(scope => !scopes.has(scope)) || requiredFields.some(field => !fields.has(field))) {
    throw Object.assign(new Error("A conta precisa ser reautorizada com as permissões e eventos exigidos por este gatilho"), { status: 400 });
  }
}
