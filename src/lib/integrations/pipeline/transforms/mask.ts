import type { IntegrationEvent } from "../../types";
import type { TransformContext, TransformFn } from "../types";

// Field names that contain PII and should be masked before leaving the system.
const PII_KEY_RE  = /^(email|phone|tel|cpf|cnpj|ssn|name|nome|sobrenome|surname|ip|address|endereco)$/i;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CPF_RE      = /^\d{3}[\.\-]?\d{3}[\.\-]?\d{3}[\-\.]?\d{2}$/;

function maskString(key: string, value: string): string {
  if (EMAIL_RE.test(value)) {
    const [local, domain] = value.split("@");
    const masked = local.length > 2 ? local[0] + "***" : "***";
    return masked + "@" + domain;
  }
  if (CPF_RE.test(value)) {
    const d = value.replace(/\D/g, "");
    return `***${d.slice(3, 6)}***${d.slice(-2)}`;
  }
  return value.length > 2
    ? value[0] + "*".repeat(value.length - 2) + value[value.length - 1]
    : "**";
}

function maskValue(key: string, value: unknown): unknown {
  if (typeof value === "string" && PII_KEY_RE.test(key)) return maskString(key, value);
  return value;
}

function maskObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      result[k] = maskObject(v as Record<string, unknown>);
    } else {
      result[k] = maskValue(k, v);
    }
  }
  return result;
}

export const maskTransform: TransformFn = {
  name: "mask",
  transform(event: IntegrationEvent, _ctx: TransformContext): IntegrationEvent {
    return {
      ...event,
      payload: maskObject(event.payload as Record<string, unknown>),
    };
  },
};
