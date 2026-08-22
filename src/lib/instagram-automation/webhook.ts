import { createHash } from "node:crypto";
import type { NormalizedInstagramEvent } from "./types";

function isoFromTimestamp(value: unknown, fallback: unknown) {
  const raw = Number(value ?? fallback ?? Date.now());
  const milliseconds = raw < 10_000_000_000 ? raw * 1000 : raw;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function fallbackId(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 40);
}

export function parseInstagramWebhook(payload: unknown): NormalizedInstagramEvent[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { object?: unknown; entry?: unknown[] };
  if (body.object !== "instagram" || !Array.isArray(body.entry)) return [];
  const events: NormalizedInstagramEvent[] = [];

  for (const rawEntry of body.entry) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const entry = rawEntry as { id?: unknown; time?: unknown; changes?: unknown[]; messaging?: unknown[] };
    const accountId = String(entry.id ?? "");
    if (!accountId) continue;

    for (const rawChange of entry.changes ?? []) {
      if (!rawChange || typeof rawChange !== "object") continue;
      const change = rawChange as { field?: unknown; value?: unknown };
      if (change.field !== "comments" && change.field !== "live_comments") continue;
      const values = Array.isArray(change.value) ? change.value : [change.value];
      for (const rawValue of values) {
        if (!rawValue || typeof rawValue !== "object") continue;
        const value = rawValue as {
          id?: unknown; text?: unknown; from?: { id?: unknown; username?: unknown };
          media?: { id?: unknown };
        };
        const commentId = String(value.id ?? "");
        const rawPayload = rawValue as Record<string, unknown>;
        const id = commentId || fallbackId({ accountId, entryTime: entry.time, rawPayload });
        events.push({
          accountId,
          externalEventId: `comment:${id}`,
          eventType: "comment",
          senderScopedId: value.from?.id ? String(value.from.id) : null,
          senderUsername: value.from?.username ? String(value.from.username) : null,
          commentId: commentId || null,
          mediaId: value.media?.id ? String(value.media.id) : null,
          messageId: null,
          text: String(value.text ?? ""),
          occurredAt: isoFromTimestamp(undefined, entry.time),
          rawPayload,
        });
      }
    }

    for (const rawMessaging of entry.messaging ?? []) {
      if (!rawMessaging || typeof rawMessaging !== "object") continue;
      const item = rawMessaging as {
        sender?: { id?: unknown }; recipient?: { id?: unknown }; timestamp?: unknown; is_self?: unknown;
        message?: { mid?: unknown; text?: unknown; is_echo?: unknown; is_self?: unknown; quick_reply?: { payload?: unknown }; reply_to?: { story?: unknown } };
        postback?: { mid?: unknown; title?: unknown; payload?: unknown };
      };
      if (item.is_self || item.message?.is_echo || item.message?.is_self) continue;
      const senderId = item.sender?.id ? String(item.sender.id) : null;
      if (!senderId || senderId === accountId) continue;
      const isPostback = Boolean(item.postback);
      if (!isPostback && !item.message) continue;
      const messageId = String(item.message?.mid ?? item.postback?.mid ?? "");
      const eventType = isPostback ? "postback" : item.message?.reply_to?.story ? "story_reply" : "message";
      const text = String(item.message?.quick_reply?.payload ?? item.message?.text ?? item.postback?.payload ?? item.postback?.title ?? "");
      const rawPayload = rawMessaging as Record<string, unknown>;
      const id = messageId || fallbackId({ accountId, senderId, timestamp: item.timestamp, rawPayload });
      events.push({
        accountId,
        externalEventId: `${eventType}:${id}`,
        eventType,
        senderScopedId: senderId,
        senderUsername: null,
        commentId: null,
        mediaId: null,
        messageId: messageId || null,
        text,
        occurredAt: isoFromTimestamp(item.timestamp, entry.time),
        rawPayload,
      });
    }
  }
  return events;
}
