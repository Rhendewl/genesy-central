import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

const TOKEN_PREFIX = "gptl_";
const COOKIE_PREFIX = "genesy_portal_";

export type AuthorizedPortal = {
  id: string;
  user_id: string;
  name: string;
  status: "ativo" | "pausado";
  client_id: string | null;
};

export type PortalAccessFailure = {
  ok: false;
  status: 401 | 403 | 404 | 500;
  error: string;
};

export type PortalAccessSuccess = {
  ok: true;
  portal: AuthorizedPortal;
  tokenId: string;
  expiresAt: string;
  db: ReturnType<typeof createAdminSupabaseClient>;
};

export type PortalAccessResult = PortalAccessFailure | PortalAccessSuccess;

export function generatePortalAccessToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashPortalAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function portalAccessCookieName(slug: string): string {
  const slugDigest = createHash("sha256").update(slug, "utf8").digest("hex").slice(0, 20);
  return `${COOKIE_PREFIX}${slugDigest}`;
}

export function getPortalAccessToken(req: NextRequest, slug: string): string | null {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer) return bearer;
  }
  return req.cookies.get(portalAccessCookieName(slug))?.value ?? null;
}

export async function authorizePortalAccess(
  req: NextRequest,
  slug: string,
  explicitToken?: string | null,
): Promise<PortalAccessResult> {
  const token = explicitToken ?? getPortalAccessToken(req, slug);
  if (!token || !token.startsWith(TOKEN_PREFIX)) {
    // Rejeita o slug sozinho antes mesmo de consultar a existência do objeto.
    return { ok: false, status: 401, error: "Link seguro necessário" };
  }

  let db: ReturnType<typeof createAdminSupabaseClient>;
  try {
    db = createAdminSupabaseClient();
  } catch {
    return { ok: false, status: 500, error: "Configuração de segurança indisponível" };
  }

  const { data: portal, error: portalError } = await db
    .from("portals")
    .select("id, user_id, name, status, client_id")
    .eq("slug", slug)
    .maybeSingle();

  if (portalError || !portal) {
    return { ok: false, status: 404, error: "Portal não encontrado" };
  }
  if (portal.status !== "ativo") {
    return { ok: false, status: 403, error: "Portal pausado" };
  }

  const now = new Date();
  const { data: accessToken, error: tokenError } = await db
    .from("portal_access_tokens")
    .select("id, portal_id, expires_at, revoked_at, last_used_at")
    .eq("portal_id", portal.id)
    .eq("token_hash", hashPortalAccessToken(token))
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  if (tokenError || !accessToken) {
    return { ok: false, status: 401, error: "Link inválido, expirado ou revogado" };
  }

  // Evita uma escrita a cada gráfico carregado, mas mantém uma trilha recente de uso.
  const lastUsedAt = accessToken.last_used_at ? new Date(accessToken.last_used_at).getTime() : 0;
  if (now.getTime() - lastUsedAt > 5 * 60_000) {
    void db
      .from("portal_access_tokens")
      .update({ last_used_at: now.toISOString() })
      .eq("id", accessToken.id)
      .eq("portal_id", portal.id);
  }

  return {
    ok: true,
    portal: portal as AuthorizedPortal,
    tokenId: accessToken.id,
    expiresAt: accessToken.expires_at,
    db,
  };
}

export function portalNoStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}
