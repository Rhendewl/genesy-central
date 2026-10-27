import { createHmac, timingSafeEqual } from "crypto";

export function validSignature(
  raw: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature))
    return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export function contactHash(phone: string): string {
  const key = process.env.WHATSAPP_CONTACT_HASH_KEY;
  if (!key || key.length < 32)
    throw new Error("Chave de privacidade não configurada");
  const normalized = phone.replace(/[+\s()-]/g, "");
  if (!/^\d{8,15}$/.test(normalized))
    throw new Error("Informe o telefone com DDI e DDD");
  return createHmac("sha256", key).update(normalized).digest("hex");
}
export type ObservedMessage = {
  id: string;
  consent_id: string;
  direction: "inbound" | "outbound";
  sent_at: string;
  kind?: string;
};
export function metrics(messages: ObservedMessage[], now = Date.now()) {
  const groups = new Map<string, ObservedMessage[]>();
  for (const m of messages) {
    if (new Date(m.sent_at).getTime() > now) continue;
    const rows = groups.get(m.consent_id) ?? [];
    if (!rows.some((r) => r.id === m.id)) rows.push(m);
    groups.set(m.consent_id, rows);
  }
  let attended = 0,
    contacted = 0,
    replied = 0,
    followups = 0,
    awaitingSdr = 0,
    awaitingLead = 0;
  const responseSeconds: number[] = [];
  for (const rows of Array.from(groups.values())) {
    rows.sort(
      (a, b) => a.sent_at.localeCompare(b.sent_at) || a.id.localeCompare(b.id),
    );
    const outbound = rows.find((m) => m.direction === "outbound");
    if (outbound) {
      attended++;
      contacted++;
      if (
        rows.some(
          (m) => m.direction === "inbound" && m.sent_at > outbound.sent_at,
        )
      )
        replied++;
    }
    const inbound = rows.find((m) => m.direction === "inbound");
    const answer =
      inbound &&
      rows.find(
        (m) => m.direction === "outbound" && m.sent_at > inbound.sent_at,
      );
    if (answer && inbound)
      responseSeconds.push(
        (Date.parse(answer.sent_at) - Date.parse(inbound.sent_at)) / 1000,
      );
    for (let i = 1; i < rows.length; i++)
      if (
        rows[i].direction === "outbound" &&
        rows[i - 1].direction === "outbound" &&
        Date.parse(rows[i].sent_at) - Date.parse(rows[i - 1].sent_at) >=
          86400000
      )
        followups++;
    const last = rows[rows.length - 1];
    if (now - Date.parse(last.sent_at) >= 172800000) {
      if (last.direction === "inbound") awaitingSdr++;
      else awaitingLead++;
    }
  }
  responseSeconds.sort((a, b) => a - b);
  const n = responseSeconds.length;
  return {
    conversations: groups.size,
    messages: Array.from(groups.values()).reduce((s, r) => s + r.length, 0),
    attended,
    contacted,
    replied,
    responseRate: contacted ? replied / contacted : null,
    firstResponseSamples: n,
    medianFirstResponseSeconds: n
      ? (responseSeconds[Math.floor((n - 1) / 2)] +
          responseSeconds[Math.floor(n / 2)]) /
        2
      : null,
    followups,
    awaitingSdr,
    awaitingLead,
  };
}
export type WebhookMessage = {
  phone: string;
  waba: string;
  contact: string;
  provider: string;
  direction: "inbound" | "outbound";
  sent: string;
  kind: string;
  body: string | null;
};
// Strict allowlist: discard history, contact book, statuses, media and unknown payload fields.
export function parseWebhook(payload: unknown): WebhookMessage[] {
  const root = payload as {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{
        field?: string;
        value?: {
          metadata?: { phone_number_id?: string };
          messages?: Array<Record<string, unknown>>;
          message_echoes?: Array<Record<string, unknown>>;
        };
      }>;
    }>;
  };
  if (
    root?.object !== "whatsapp_business_account" ||
    !Array.isArray(root.entry)
  )
    return [];
  const result: WebhookMessage[] = [];
  for (const entry of root.entry)
    for (const change of entry.changes ?? []) {
      if (!["messages", "smb_message_echoes"].includes(change.field ?? ""))
        continue;
      const value = change.value;
      const outbound = change.field === "smb_message_echoes";
      for (const m of (outbound ? value?.message_echoes : value?.messages) ??
        []) {
        const contact = outbound ? m.to : m.from;
        const seconds = Number(m.timestamp);
        if (
          typeof contact !== "string" ||
          !/^\d{8,15}$/.test(contact) ||
          typeof m.id !== "string" ||
          !Number.isFinite(seconds) ||
          seconds <= 0 ||
          seconds > 1e11 ||
          !value?.metadata?.phone_number_id ||
          !entry.id
        )
          continue;
        const body =
          m.type === "text" &&
          typeof (m.text as { body?: unknown })?.body === "string"
            ? (m.text as { body: string }).body.slice(0, 12000)
            : null;
        result.push({
          phone: value.metadata.phone_number_id,
          waba: entry.id,
          contact,
          provider: m.id,
          direction: outbound ? "outbound" : "inbound",
          sent: new Date(seconds * 1000).toISOString(),
          kind: typeof m.type === "string" ? m.type : "unknown",
          body,
        });
      }
    }
  return result;
}
export type Finding = {
  category: "objection" | "intent" | "service";
  label: string;
  evidence_ids: string[];
  confidence: number;
};
export function validateFindings(value: unknown, ids: string[]): Finding[] {
  if (!Array.isArray(value) || value.length > 12)
    throw new Error("Resposta de IA inválida");
  return value.map((v) => {
    if (
      !v ||
      !["objection", "intent", "service"].includes(v.category) ||
      typeof v.label !== "string" ||
      v.label.length > 240 ||
      !Array.isArray(v.evidence_ids) ||
      !v.evidence_ids.length ||
      !v.evidence_ids.every(
        (id: unknown) => typeof id === "string" && ids.includes(id),
      ) ||
      typeof v.confidence !== "number" ||
      v.confidence < 0 ||
      v.confidence > 1
    )
      throw new Error("IA sem evidência válida");
    return {
      category: v.category,
      label: v.label,
      evidence_ids: v.evidence_ids,
      confidence: v.confidence,
    };
  });
}
