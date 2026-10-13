import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { fetchAllAccountBalances } from "@/lib/portal-account-balances";
import { processPortalBalanceAlerts } from "@/lib/portal-balance-alerts";

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
