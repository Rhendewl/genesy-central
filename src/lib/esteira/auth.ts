import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ─────────────────────────────────────────────────────────────────────────────
// Autenticação da Esteira
//
//  - Agentes (Alfred, Bruce): chamam /api/esteira/agente/* do servidor deles
//    com "Authorization: Bearer <ESTEIRA_AGENT_SECRET>". Tudo o que gravam vai
//    para a conta ESTEIRA_OWNER_ID (o dono da agência). Sem as duas variáveis,
//    as rotas dos agentes ficam desligadas (503).
//  - Painel: owner da conta ou admin, pela sessão (mesmo critério do módulo
//    Site Genesy).
// ─────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export function secretMatches(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (!received || !expected || expected.length < 32) return false;
  return timingSafeEqual(sha256(received), sha256(expected));
}

export type AgentAuth = { ok: true; ownerId: string } | { ok: false; status: 401 | 503; error: string };

export function authenticateAgent(req: NextRequest): AgentAuth {
  const secret = process.env.ESTEIRA_AGENT_SECRET;
  const ownerId = process.env.ESTEIRA_OWNER_ID;
  if (!secret || secret.length < 32 || !ownerId || !UUID.test(ownerId)) {
    return { ok: false, status: 503, error: "Esteira não configurada no servidor (ESTEIRA_AGENT_SECRET / ESTEIRA_OWNER_ID)." };
  }
  const received = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(received, secret)) return { ok: false, status: 401, error: "Não autorizado" };
  return { ok: true, ownerId };
}

export async function esteiraPanelContext() {
  const db = await createServerSupabaseClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profiles } = await db.from("user_profiles").select("owner_id,role,is_active").eq("auth_user_id", user.id);
  const active = (profiles ?? []).filter((row) => row.is_active);
  const profile = active.find((row) => row.owner_id !== user.id) ?? active[0];
  const ownerId: string = profile?.owner_id ?? user.id;
  const canManage = ownerId === user.id || profile?.role === "admin";
  return { user, ownerId, canManage };
}
