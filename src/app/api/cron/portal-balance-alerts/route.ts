import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { fetchPortalAccountBalances } from "@/lib/portal-account-balances";
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
  const { data: portals, error } = await db
    .from("portals")
    .select("id, user_id, name")
    .eq("status", "ativo")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const portal of portals ?? []) {
    try {
      const result = await fetchPortalAccountBalances(db, portal.id, portal.user_id);
      if (result.error) throw new Error(result.error);
      const alerts = await processPortalBalanceAlerts(db, {
        portalId: portal.id,
        portalName: portal.name,
        ownerUserId: portal.user_id,
        balances: result.balances,
      });
      results.push({ portalId: portal.id, ok: true, accounts: result.balances.length, ...alerts });
    } catch (portalError) {
      results.push({
        portalId: portal.id,
        ok: false,
        error: portalError instanceof Error ? portalError.message : "Falha desconhecida",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
