import { normalizeInstagramText } from "../matching";
import { FLOW_MAX_WAIT_MINUTES, FLOW_PAYLOAD_PREFIX, type CollectedFieldKind, type ConditionNodeData, type MessageNodeData } from "./types";

const STANDARD_WINDOW_MS = 24 * 60 * 60_000;
const PRIVATE_REPLY_WINDOW_MS = FLOW_MAX_WAIT_MINUTES * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Payload carried by reply buttons so a tap resumes the exact run and branch. */
export function buildFlowPayload(runId: string, nodeId: string, buttonId: string) {
  return `${FLOW_PAYLOAD_PREFIX}${runId}:${nodeId}:${buttonId}`;
}

export function parseFlowPayload(text: string | null | undefined) {
  if (!text || !text.startsWith(FLOW_PAYLOAD_PREFIX)) return null;
  const [runId, nodeId, buttonId, ...rest] = text.slice(FLOW_PAYLOAD_PREFIX.length).split(":");
  if (rest.length || !UUID.test(runId ?? "") || !nodeId || !buttonId) return null;
  return { runId, nodeId, buttonId };
}

export interface ContactWindowInput { lastMessageAt: string | null; adWindowUntil: string | null }

/**
 * Meta's standard messaging window: 24h after the contact's last message, or
 * up to 7 days after the first message sent from a Click-to-Direct ad.
 */
export function contactWindow(contact: ContactWindowInput, now = new Date()) {
  const organic = contact.lastMessageAt ? new Date(contact.lastMessageAt).getTime() + STANDARD_WINDOW_MS : NaN;
  const ad = contact.adWindowUntil ? new Date(contact.adWindowUntil).getTime() : NaN;
  const candidates = [
    Number.isFinite(organic) ? { until: organic, source: "organic" as const } : null,
    Number.isFinite(ad) ? { until: ad, source: "ad" as const } : null,
  ].filter((value): value is { until: number; source: "organic" | "ad" } => Boolean(value));
  const best = candidates.sort((a, b) => b.until - a.until)[0];
  if (!best) return { open: false, source: null, until: null };
  return { open: now.getTime() <= best.until, source: best.source, until: new Date(best.until) };
}

export function messageDelivery(input: {
  isCommentRun: boolean;
  privateReplyUsed: boolean;
  commentAt: string | null;
  window: { open: boolean };
  now?: Date;
}): { channel: "private_reply" | "dm"; reason?: undefined } | { channel: null; reason: string } {
  const now = input.now ?? new Date();
  if (input.isCommentRun && !input.privateReplyUsed) {
    const commentAt = input.commentAt ? new Date(input.commentAt).getTime() : NaN;
    if (!Number.isFinite(commentAt) || now.getTime() > commentAt + PRIVATE_REPLY_WINDOW_MS) {
      return { channel: null, reason: "Prazo de 7 dias para a resposta privada encerrado" };
    }
    return { channel: "private_reply" };
  }
  if (!input.window.open) return { channel: null, reason: "Janela de mensagens permitida pela Meta encerrada" };
  return { channel: "dm" };
}

export function evaluateCondition(
  condition: ConditionNodeData,
  context: { lastReply: string | null; tags: string[]; fromAd: boolean },
) {
  if (condition.kind === "from_ad") return context.fromAd;
  const values = condition.value.split(",").map(normalizeInstagramText).filter(Boolean);
  if (!values.length) return false;
  if (condition.kind === "has_tag") {
    const tags = new Set(context.tags.map(normalizeInstagramText));
    return values.some(value => tags.has(value));
  }
  const reply = normalizeInstagramText(context.lastReply ?? "");
  return Boolean(reply) && values.some(value => reply.includes(value));
}

/** Graph API message body. Reply buttons become postbacks carrying the run payload. */
export function instagramMessageBody(data: MessageNodeData, payloadFor: (buttonId: string) => string) {
  if (!data.buttons.length) return { text: data.text };
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: data.text,
        buttons: data.buttons.map(button => button.kind === "url"
          ? { type: "web_url", url: button.url, title: button.label }
          : { type: "postback", title: button.label, payload: payloadFor(button.id) }),
      },
    },
  };
}

export function addTag(tags: string[] | null | undefined, tag: string) {
  const clean = tag.trim();
  const current = tags ?? [];
  if (!clean || current.some(item => normalizeInstagramText(item) === normalizeInstagramText(clean))) return current;
  return [...current, clean].slice(-50);
}

/** "Cidade de interesse" → "cidade_de_interesse": the variable name of a custom field. */
export function fieldSlug(label: string) {
  return normalizeInstagramText(label).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export function collectedFieldKey(kind: CollectedFieldKind, label?: string) {
  if (kind === "phone") return "whatsapp";
  if (kind === "custom") return fieldSlug(label ?? "") || "campo";
  return kind === "name" ? "nome" : "email";
}

/**
 * Checks and normalizes an answer. WhatsApp keeps digits only (adds Brazil's 55
 * to 10–11 digit numbers); e-mail must look like one. Names and free fields are
 * accepted as typed.
 */
export function validateCollectedAnswer(kind: CollectedFieldKind, answer: string): { ok: boolean; value: string } {
  const text = answer.trim();
  if (kind === "phone") {
    const digits = text.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) return { ok: false, value: text };
    return { ok: true, value: digits.length <= 11 ? `55${digits}` : digits };
  }
  if (kind === "email") {
    const email = text.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0];
    return email ? { ok: true, value: email } : { ok: false, value: text };
  }
  return { ok: Boolean(text), value: text.slice(0, 500) };
}

export function firstName(fullName: string | null | undefined) {
  const first = String(fullName ?? "").trim().split(/\s+/)[0] ?? "";
  // Profile names often carry emoji or symbols; keep letters only for the greeting.
  const clean = first.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'-]/g, "");
  if (!clean) return "";
  return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1).toLocaleLowerCase("pt-BR");
}

export interface TemplateContext {
  fullName: string | null;
  username: string | null;
  lastReply: string | null;
  fields: Record<string, string>;
}

export function templateVariables(context: TemplateContext): Record<string, string> {
  const name = context.fields.nome || context.fullName || "";
  return {
    ...context.fields,
    primeiro_nome: firstName(name),
    nome: name.trim(),
    usuario: context.username ? `@${context.username}` : "",
    whatsapp: context.fields.whatsapp ?? "",
    email: context.fields.email ?? "",
    resposta: context.lastReply ?? "",
  };
}

/**
 * Replaces {variables}. Unknown placeholders stay as typed; an empty value is
 * removed together with the space before it, so "Oi {primeiro_nome}!" becomes
 * "Oi!" when the name is unknown.
 */
export function renderTemplate(text: string, variables: Record<string, string>) {
  return text
    .replace(/(\s?)\{([a-z0-9_]+)\}/gi, (match, space: string, key: string) => {
      const value = variables[key.toLowerCase()];
      if (value === undefined) return match;
      return value ? `${space}${value}` : "";
    })
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .replace(/^[,;:]\s*(.)/, (_match, first: string) => first.toLocaleUpperCase("pt-BR"));
}

export function templateUsesName(text: string) {
  return /\{(primeiro_nome|nome)\}/i.test(text);
}
