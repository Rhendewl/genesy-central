import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export class CIError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function context(req: NextRequest) {
  if (req.method !== "GET" && req.headers.get("origin") !== req.nextUrl.origin)
    throw new CIError("Origem inválida", 403);
  const userDb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userDb.auth.getUser();
  if (!user) throw new CIError("Não autenticado", 401);
  const { data: tenant, error } = await userDb.rpc("effective_owner_id");
  if (error || !tenant) throw new CIError("Conta indisponível", 403);
  const db = createAdminSupabaseClient();
  const { data: profiles, error: profileError } = await db
    .from("user_profiles")
    .select("role,permissions")
    .eq("auth_user_id", user.id)
    .eq("owner_id", tenant)
    .eq("is_active", true);
  const profile = profiles?.find(
    (p) =>
      ["admin", "comercial", "gestor_comercial"].includes(p.role) &&
      (user.id === tenant || p.permissions?.includes("crm")),
  );
  if (profileError || !profile)
    throw new CIError("Acesso comercial necessário", 403);
  return {
    db,
    userDb,
    user,
    tenant: tenant as string,
    role: profile.role as string,
  };
}
export function fail(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof CIError
          ? error.message
          : "Não foi possível concluir. Verifique a configuração do módulo.",
    },
    { status: error instanceof CIError ? error.status : 503 },
  );
}
export function check(error: unknown) {
  if (error)
    throw new CIError(
      "Persistência indisponível. Verifique a migração do módulo.",
      503,
    );
}
export const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
    value,
  );
export function configuration() {
  const keys = [
    "META_APP_ID",
    "META_APP_SECRET",
    "WHATSAPP_SIGNUP_CONFIG_ID",
    "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_CONTACT_HASH_KEY",
    "TOKEN_ENCRYPTION_KEY",
    "WHATSAPP_GRAPH_VERSION",
  ];
  return {
    ready: keys.every((k) => Boolean(process.env[k])),
    missing: keys.filter((k) => !process.env[k]),
  };
}
export async function graph(
  path: string,
  token: string,
  init: RequestInit = {},
) {
  const version = process.env.WHATSAPP_GRAPH_VERSION;
  if (!version || !/^v\d+\.0$/.test(version))
    throw new CIError("Versão da API Meta não configurada", 503);
  const response = await fetch(
    `https://graph.facebook.com/${version}/${path}`,
    {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await response.json();
  if (!response.ok || data.error)
    throw new CIError(
      "A Meta não autorizou esta operação. Verifique permissões, elegibilidade e validade da conexão.",
      502,
    );
  return data;
}
