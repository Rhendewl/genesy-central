import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { fetchAllAccountBalances, fetchPortalAccountBalances } from "@/lib/portal-account-balances";
import { isAccountBalanceMigrationMissing, processPortalBalanceAlerts } from "@/lib/portal-balance-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const received = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    ?? req.headers.get("x-cron-secret");
  if (!expected || received !== expected) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = createAdminSupabaseClient();
  const { error: storeError } = await db.from("account_balance_alert_states").select("ad_account_id").limit(1);
  if (isAccountBalanceMigrationMissing(storeError)) {
    // Keep existing portal alerts running until the separate balance migration is applied.
    const { data: portals, error } = await db.from("portals").select("id,user_id,name").eq("status", "ativo");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const results = [];
    for (const portal of portals ?? []) {
      try {
        const result = await fetchPortalAccountBalances(db, portal.id, portal.user_id);
        if (result.error) throw new Error(result.error);
        const alerts = await processPortalBalanceAlerts(db, {
          portalId: portal.id, portalName: portal.name, ownerUserId: portal.user_id, balances: result.balances,
        });
        results.push({ portalId: portal.id, ok: true, ...alerts });
      } catch (error) {
        results.push({ portalId: portal.id, ok: false, error: error instanceof Error ? error.message : "Falha desconhecida" });
      }
    }
    return NextResponse.json({ processed: results.length, results, migrationRequired: true });
  }
  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 });

  const { data: accounts, error } = await db
    .from("ad_platform_accounts")
    .select("user_id")
    .eq("platform", "meta")
    .eq("status", "connected")
    .not("account_id", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ownerUserIds = Array.from(new Set((accounts ?? []).map(account => account.user_id as string)));
  const results = [];
  for (const ownerUserId of ownerUserIds) {
    try {
      const result = await fetchAllAccountBalances(db, ownerUserId);
      const alerts = await processPortalBalanceAlerts(db, {
        ownerUserId,
        balances: result.balances,
      });
      results.push({
        ownerUserId,
        ok: true,
        accounts: result.balances.length,
        accountErrors: result.errors,
        ...alerts,
      });
    } catch (ownerError) {
      results.push({
        ownerUserId,
        ok: false,
        error: ownerError instanceof Error ? ownerError.message : "Falha desconhecida",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
