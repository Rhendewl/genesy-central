export const dynamic = "force-dynamic"; // always live, never cached

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { decryptToken } from "@/lib/crypto";
import { getAdAccountDetails } from "@/lib/meta-api";
import type { PortalAccountBalance } from "@/types";
import { META_BR_TAX_RATE } from "@/types";

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function mapFundingType(raw: number | string | undefined): string {
  // Meta returns funding_source_details.type as a numeric code
  const n = typeof raw === "string" ? parseInt(raw, 10) : (raw ?? -1);
  const map: Record<number, string> = {
    1:  "Cartão de crédito",
    2:  "Transferência manual",
    4:  "Crédito pré-pago",
    8:  "Crédito estendido",
    9:  "Transferência isenta de imposto",
    12: "Linha de crédito de agência",
  };
  if (!isNaN(n) && map[n]) return map[n];
  // Fallback: string values occasionally returned
  const strMap: Record<string, string> = {
    PREPAY:          "Pré-paga",
    POSTPAY_AUTOPAY: "Pós-paga (débito automático)",
    POSTPAY_INVOICE: "Pós-paga (fatura)",
    POSTPAY_MANUAL:  "Pós-paga (manual)",
  };
  if (typeof raw === "string" && strMap[raw]) return strMap[raw];
  return String(raw ?? "");
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANCE CALCULATION — BRL accounts
//
// The Meta API `balance` field already contains the NET spendable balance
// (i.e., what Ads Manager shows as "Saldo disponível"). Brazilian taxes (IOF
// + platform fees ≈ 12.15%) are deducted by Meta at the time of deposit, NOT
// when this API is queried. Applying the deduction again would produce a value
// ~12% lower than reality — which is exactly the bug this fixes.
//
// Correct formulas:
//   balance_net   = balance / 100                          ← shown as "Saldo disponível"
//   balance_gross = balance_net / (1 − META_BR_TAX_RATE)  ← original deposit amount
//
// For postpaid accounts `balance` is 0; available is derived from spend_cap.
// ─────────────────────────────────────────────────────────────────────────────

function toUnit(raw: string | undefined): number {
  const n = parseFloat(raw ?? "0");
  return isNaN(n) ? 0 : n / 100;
}

interface BalanceResult {
  balance_net: number;
  balance_gross: number;
  is_prepay: boolean;
  has_spend_cap: boolean;
  spend_cap_remaining: number;
}

function computeBalance(
  balanceRaw: string,
  amountSpentRaw: string,
  spendCapRaw: string,
  fundingType: number | string | undefined,
  currency: string,
): BalanceResult {
  const balanceUnits  = toUnit(balanceRaw);   // NET balance from API (already tax-deducted)
  const amountSpent   = toUnit(amountSpentRaw);
  const spendCap      = toUnit(spendCapRaw);

  // Detect prepaid: balance > 0 is the reliable signal.
  // funding_source_details.type codes 4 (prepay_credit) or 2 (manual) also indicate prepay.
  const fundingCode = typeof fundingType === "string" ? parseInt(fundingType, 10) : (fundingType ?? -1);
  const isPrepayByCode = fundingCode === 4 || fundingCode === 2 ||
                         fundingType === "PREPAY";
  const isPrepay = balanceUnits > 0 || isPrepayByCode;

  if (isPrepay && balanceUnits > 0) {
    // CORRECT: the API balance IS the available (net) balance.
    // Back-calculate gross only for informational display.
    const net   = balanceUnits;
    const gross = currency === "BRL" ? net / (1 - META_BR_TAX_RATE) : net;
    return { balance_net: net, balance_gross: gross, is_prepay: true, has_spend_cap: false, spend_cap_remaining: 0 };
  }

  if (spendCap > 0) {
    // Postpaid with a spend cap: remaining = cap − spent
    const remaining = Math.max(0, spendCap - amountSpent);
    return { balance_net: remaining, balance_gross: remaining, is_prepay: false, has_spend_cap: true, spend_cap_remaining: remaining };
  }

  // Postpaid unlimited or no data
  return { balance_net: 0, balance_gross: 0, is_prepay: false, has_spend_cap: false, spend_cap_remaining: 0 };
}

// GET /api/portal/[slug]/balance — public endpoint, no auth required
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    let admin;
    let db: ReturnType<typeof createAnonClient>;
    try {
      admin = createAdminSupabaseClient();
      db = admin;
    } catch {
      console.warn("[portal/balance] service role key not configured");
      db = createAnonClient();
    }

    // 1. Resolve portal
    const { data: rawPortal } = await db
      .from("portals")
      .select("id, user_id, status")
      .eq("slug", slug)
      .maybeSingle();

    if (!rawPortal || rawPortal.status === "pausado") {
      return NextResponse.json({ balances: [], error: "Portal indisponível" });
    }
    if (!admin) {
      return NextResponse.json({ balances: [], error: "Configuração incompleta" });
    }

    // 2. Allowed ad accounts for this portal
    const { data: portalAccounts } = await admin
      .from("portal_accounts")
      .select("ad_account_id")
      .eq("portal_id", rawPortal.id);

    const allowedAccountIds = (portalAccounts ?? []).map(
      (pa: { ad_account_id: string }) => pa.ad_account_id
    );
    if (allowedAccountIds.length === 0) return NextResponse.json({ balances: [] });

    // 3. Platform accounts (scoped to portal owner)
    const { data: platformAccounts } = await admin
      .from("ad_platform_accounts")
      .select("id, account_id, account_name")
      .eq("user_id", rawPortal.user_id)
      .in("account_id", allowedAccountIds);

    if (!platformAccounts?.length) return NextResponse.json({ balances: [] });

    const platformAccountIds = platformAccounts.map((pa: { id: string }) => pa.id);

    // 4. Meta tokens
    const { data: tokens } = await admin
      .from("meta_tokens")
      .select("platform_account_id, encrypted_token")
      .in("platform_account_id", platformAccountIds);

    if (!tokens?.length) {
      return NextResponse.json({ balances: [], error: "Conta Meta não conectada" });
    }

    const tokenMap = new Map<string, string>();
    for (const t of tokens) {
      try { tokenMap.set(t.platform_account_id, decryptToken(t.encrypted_token)); }
      catch { /* skip bad tokens */ }
    }
    if (tokenMap.size === 0) {
      return NextResponse.json({ balances: [], error: "Token inválido ou expirado" });
    }

    // 5. Fetch account details live from Meta API
    const fetchedAt = new Date().toISOString();
    const balances: PortalAccountBalance[] = [];

    for (const pa of platformAccounts as { id: string; account_id: string; account_name: string }[]) {
      const token = tokenMap.get(pa.id);
      if (!token) continue;

      try {
        const details = await getAdAccountDetails(pa.account_id, token);

        // ── DIAGNOSTIC LOG — helps identify correct field for wallet balance ──
        console.log("[portal/balance] Meta API raw response:", {
          id:             details.id,
          name:           details.name,
          account_status: details.account_status,
          currency:       details.currency,
          // balance: NET spendable in centavos (what Ads Manager shows as "Saldo disponível")
          balance_raw:          details.balance,
          balance_in_units:     toUnit(details.balance),
          amount_spent_raw:     details.amount_spent,
          amount_spent_units:   toUnit(details.amount_spent),
          spend_cap_raw:        details.spend_cap,
          spend_cap_units:      toUnit(details.spend_cap),
          funding_source_details: details.funding_source_details,
        });
        // ── END DIAGNOSTIC LOG ──

        const { balance_net, balance_gross, is_prepay } = computeBalance(
          details.balance,
          details.amount_spent,
          details.spend_cap,
          details.funding_source_details?.type,
          details.currency,
        );

        const fundingType = mapFundingType(details.funding_source_details?.type);

        console.log("[portal/balance] computed:", {
          account_id:    details.id,
          is_prepay,
          balance_net,
          balance_gross,
          tax_rate_pct:  is_prepay && details.currency === "BRL"
            ? `${(META_BR_TAX_RATE * 100).toFixed(2)}%`
            : "N/A",
        });

        balances.push({
          account_id:      details.id,
          account_name:    details.name,
          account_status:  details.account_status,
          currency:        details.currency,
          balance_gross,
          balance_net,
          amount_spent:    toUnit(details.amount_spent),
          funding_type:    fundingType,
          funding_display: details.funding_source_details?.display_string ?? null,
          is_prepay,
          fetched_at:      fetchedAt,
        });

      } catch (err) {
        console.error(`[portal/balance] failed to fetch account ${pa.account_id}:`, err);
        balances.push({
          account_id:      pa.account_id,
          account_name:    pa.account_name,
          account_status:  0,
          currency:        "BRL",
          balance_gross:   0,
          balance_net:     0,
          amount_spent:    0,
          funding_type:    "",
          funding_display: null,
          is_prepay:       false,
          fetched_at:      fetchedAt,
        });
      }
    }

    return NextResponse.json({ balances });

  } catch (err) {
    console.error("[portal/balance] unhandled error:", err);
    return NextResponse.json({ balances: [], error: "Erro ao consultar saldo" });
  }
}
