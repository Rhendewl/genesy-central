export const dynamic = "force-dynamic"; // always live, never cached

import { NextRequest, NextResponse } from "next/server";
import { authorizePortalAccess, portalNoStoreHeaders } from "@/lib/portal-access";
import { fetchPortalAccountBalances } from "@/lib/portal-account-balances";
import { processPortalBalanceAlerts } from "@/lib/portal-balance-alerts";

// GET /api/portal/[slug]/balance — exige credencial segura do portal
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const access = await authorizePortalAccess(req, slug);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status, headers: portalNoStoreHeaders() });
    }
    const admin = access.db;
    const rawPortal = access.portal;

    const balanceResult = await fetchPortalAccountBalances(admin, rawPortal.id, rawPortal.user_id);
    if (balanceResult.error) {
      return NextResponse.json(
        { balances: balanceResult.balances, error: balanceResult.error },
        { headers: portalNoStoreHeaders() },
      );
    }
    const balances = balanceResult.balances;

    // O alerta não pode impedir o cliente de consultar o saldo. Falhas são
    // registradas e uma próxima atualização do portal tentará novamente.
    await processPortalBalanceAlerts(admin, {
      portalId: rawPortal.id,
      portalName: rawPortal.name,
      ownerUserId: rawPortal.user_id,
      balances,
    }).catch(error => {
      console.error("[portal/balance] low balance notification failed:", error);
    });

    return NextResponse.json({ balances }, { headers: portalNoStoreHeaders() });

  } catch (err) {
    console.error("[portal/balance] unhandled error:", err);
    return NextResponse.json({ balances: [], error: "Erro ao consultar saldo" }, { status: 500, headers: portalNoStoreHeaders() });
  }
}
