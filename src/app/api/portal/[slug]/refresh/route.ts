export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { format, startOfMonth } from "date-fns";
import { decryptToken } from "@/lib/crypto";
import { syncMetaAccount } from "@/lib/meta-sync";
import { authorizePortalAccess, portalNoStoreHeaders } from "@/lib/portal-access";

const REFRESH_INTERVAL_MS = 90_000;

// POST /api/portal/[slug]/refresh
// Atualiza apenas contas vinculadas ao portal e usa last_sync_at como lease,
// evitando rajadas de chamadas à Meta quando o link recebe vários acessos.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const access = await authorizePortalAccess(req, slug);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status, headers: portalNoStoreHeaders() });
  }
  const db = access.db;
  const portal = access.portal;
  const body = await req.json().catch(() => ({})) as { since?: string; until?: string; manual?: boolean };
  const now = new Date();
  const currentMonthSince = format(startOfMonth(now), "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");
  // Dados históricos não mudam. O refresh público atualiza somente a
  // parcela do filtro que intersecta o mês corrente, limitando custo e latência.
  const requestedUntil = body.until ?? today;
  if (requestedUntil < currentMonthSince) {
    return NextResponse.json({ refreshed: false, accounts: 0, historical: true }, { headers: portalNoStoreHeaders() });
  }
  const since = !body.since || body.since < currentMonthSince ? currentMonthSince : body.since;
  const until = requestedUntil > today ? today : requestedUntil;

  const { data: links } = await db
    .from("portal_accounts")
    .select("ad_account_id")
    .eq("portal_id", portal.id);
  const accountIds = (links ?? []).map((link: { ad_account_id: string }) => link.ad_account_id);
  if (!accountIds.length) return NextResponse.json({ refreshed: false, accounts: 0 }, { headers: portalNoStoreHeaders() });

  const { data: accounts } = await db
    .from("ad_platform_accounts")
    .select("id, account_id, client_id, last_sync_at")
    .eq("user_id", portal.user_id)
    .in("account_id", accountIds);

  const refreshIntervalMs = body.manual ? 30_000 : REFRESH_INTERVAL_MS;
  const cutoffIso = new Date(now.getTime() - refreshIntervalMs).toISOString();
  const eligible = (accounts ?? []).filter((account: { last_sync_at: string | null }) =>
    !account.last_sync_at || new Date(account.last_sync_at).getTime() < now.getTime() - refreshIntervalMs,
  );
  if (!eligible.length) {
    return NextResponse.json({ refreshed: false, accounts: 0, throttled: true }, { headers: portalNoStoreHeaders() });
  }

  const { data: tokens } = await db
    .from("meta_tokens")
    .select("platform_account_id, encrypted_token, token_expires_at")
    .eq("user_id", portal.user_id)
    .in("platform_account_id", eligible.map((account: { id: string }) => account.id));
  const tokenByAccount = new Map(
    (tokens ?? []).map((token: { platform_account_id: string; encrypted_token: string; token_expires_at: string | null }) =>
      [token.platform_account_id, token],
    ),
  );

  const jobs = eligible.map(async (account: {
    id: string;
    account_id: string;
    client_id: string | null;
  }) => {
    const token = tokenByAccount.get(account.id);
    if (!token?.encrypted_token) return false;
    if (token.token_expires_at && new Date(token.token_expires_at) <= now) return false;

    // Aquisição atômica do lease: somente uma requisição consegue marcar
    // uma conta nula/antiga antes de iniciar a sincronização pesada.
    const { data: leased } = await db
      .from("ad_platform_accounts")
      .update({ last_sync_at: now.toISOString() })
      .eq("id", account.id)
      .eq("user_id", portal.user_id)
      .or(`last_sync_at.is.null,last_sync_at.lt.${cutoffIso}`)
      .select("id")
      .maybeSingle();
    if (!leased) return false;

    await syncMetaAccount({
      supabase: db,
      userId: portal.user_id,
      platformAccountId: account.id,
      adAccountId: account.account_id,
      clientId: account.client_id,
      accessToken: decryptToken(token.encrypted_token),
      since,
      until,
    });
    return true;
  });

  const results = await Promise.allSettled(jobs);
  const refreshedAccounts = results.filter(result => result.status === "fulfilled" && result.value).length;
  const failedAccounts = results.filter(result => result.status === "rejected").length;

  return NextResponse.json(
    { refreshed: refreshedAccounts > 0, accounts: refreshedAccounts, failed_accounts: failedAccounts },
    { headers: portalNoStoreHeaders() },
  );
}
