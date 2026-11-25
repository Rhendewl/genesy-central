import { normalizeInstagramText } from "../matching";
import { FLOW_MAX_WAIT_MINUTES, FLOW_PAYLOAD_PREFIX, type ConditionNodeData, type MessageNodeData } from "./types";

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
