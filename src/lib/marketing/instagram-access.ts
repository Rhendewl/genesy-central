import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketingServerContext } from "@/lib/marketing/server";
import { canAccess, hasCrmAccess, isInstagramOwnScoped } from "@/lib/module-permissions";
import type { InstagramAutomationInput } from "@/lib/instagram-automation/types";

type AccessContext = Pick<MarketingServerContext, "isAdmin" | "permissions"> & { user: { id: string } };

const forbidden = (message: string) => Object.assign(new Error(message), { status: 403 });

/** Bloqueia submódulos/abas do Marketing que não foram liberados ao membro. */
export function assertMarketingAccess(context: Pick<MarketingServerContext, "isAdmin" | "permissions">, key: string) {
  if (!canAccess(context.permissions, key, context.isAdmin)) {
    throw forbidden("Seu acesso não inclui esta área do Marketing");
  }
}

/** Membro restrito às contas do Instagram que ele mesmo conectou. */
export function instagramOwnScoped(context: Pick<MarketingServerContext, "isAdmin" | "permissions">) {
  return isInstagramOwnScoped(context.permissions, context.isAdmin);
}

/** Pode conectar novas contas (admin ou membro com contas próprias). */
export function canConnectInstagramAccounts(context: Pick<MarketingServerContext, "isAdmin" | "permissions">) {
  return context.isAdmin || instagramOwnScoped(context);
}

/** Pode gerenciar esta conta específica (desconectar, sincronizar, automações). */
export function canManageInstagramConnection(context: AccessContext, connection: { connected_by?: string | null }) {
  if (context.isAdmin) return true;
  return instagramOwnScoped(context) && Boolean(connection.connected_by) && connection.connected_by === context.user.id;
}

export function assertCanManageInstagramConnection(context: AccessContext, connection: { connected_by?: string | null }, message: string) {
  if (!canManageInstagramConnection(context, connection)) throw forbidden(message);
}

export function canUseInstagramCrm(context: Pick<MarketingServerContext, "isAdmin" | "permissions">) {
  return hasCrmAccess(context.permissions, context.isAdmin);
}

/** Restringe uma consulta em marketing_instagram_connections às contas visíveis. */
// Q fica sem restrição de tipo de propósito: inferir o builder do PostgREST
// por constraint estoura o limite de instanciação do TypeScript.
export function scopeInstagramConnections<Q>(query: Q, context: AccessContext): Q {
  if (!instagramOwnScoped(context)) return query;
  return (query as unknown as { eq: (column: string, value: string) => Q }).eq("connected_by", context.user.id);
}

/**
 * IDs das contas visíveis para quem só vê as próprias contas; `null` quando
 * o membro enxerga todas as contas da organização.
 */
export async function visibleInstagramConnectionIds(
  supabase: SupabaseClient,
  context: AccessContext & { organizationId: string },
): Promise<string[] | null> {
  if (!instagramOwnScoped(context)) return null;
  const { data, error } = await supabase
    .from("marketing_instagram_connections")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("connected_by", context.user.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

/** Aplica o filtro de contas visíveis em tabelas com connection_id. */
export function scopeByConnectionIds<Q>(query: Q, ids: string[] | null): Q {
  if (ids === null) return query;
  // Lista vazia: um UUID impossível garante zero linhas sem quebrar o PostgREST.
  return (query as unknown as { in: (column: string, values: string[]) => Q })
    .in("connection_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
}

/** Membros sem o CRM liberado não podem criar oportunidades pelas automações. */
export function assertInstagramCrmAllowed(
  context: Pick<MarketingServerContext, "isAdmin" | "permissions">,
  input: Pick<InstagramAutomationInput, "crmEnabled" | "flow">,
) {
  if (canUseInstagramCrm(context)) return;
  const flowUsesCrm = (input.flow?.nodes ?? []).some((node) => node.type === "action" && node.data.kind === "crm");
  if (input.crmEnabled || flowUsesCrm) {
    throw Object.assign(new Error("Seu acesso não inclui o CRM. Troque a ação \"Oportunidade no CRM\" por \"Adicionar tag\"."), { status: 400 });
  }
}
