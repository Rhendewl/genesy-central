import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto";
import { getAdAccountDetails } from "@/lib/meta-api";
import type { PortalAccountBalance } from "@/types";
import { META_BR_TAX_RATE } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

function mapFundingType(raw: number | string | undefined): string {
  const n = typeof raw === "string" ? parseInt(raw, 10) : (raw ?? -1);
  const map: Record<number, string> = {
    1: "Cartão de crédito",
    2: "Transferência manual",
    4: "Crédito pré-pago",
    8: "Crédito estendido",
    9: "Transferência isenta de imposto",
    12: "Linha de crédito de agência",
  };
  if (!isNaN(n) && map[n]) return map[n];
  const strMap: Record<string, string> = {
    PREPAY: "Pré-paga",
    POSTPAY_AUTOPAY: "Pós-paga (débito automático)",
    POSTPAY_INVOICE: "Pós-paga (fatura)",
    POSTPAY_MANUAL: "Pós-paga (manual)",
  };
  if (typeof raw === "string" && strMap[raw]) return strMap[raw];
  return String(raw ?? "");
}

function toUnit(raw: string | undefined): number {
  const value = parseFloat(raw ?? "0");
  return isNaN(value) ? 0 : value / 100;
}

export function computePortalAccountBalance(
  balanceRaw: string,
  amountSpentRaw: string,
  spendCapRaw: string,
  fundingType: number | string | undefined,
  currency: string,
) {
  const balanceUnits = toUnit(balanceRaw);
  const amountSpent = toUnit(amountSpentRaw);
  const spendCap = toUnit(spendCapRaw);
  const fundingCode = typeof fundingType === "string" ? parseInt(fundingType, 10) : (fundingType ?? -1);
  const isPrepay = balanceUnits > 0 || fundingCode === 4 || fundingCode === 2 || fundingType === "PREPAY";

  if (isPrepay) {
    const gross = currency === "BRL" ? balanceUnits / (1 - META_BR_TAX_RATE) : balanceUnits;
    return { balance_net: balanceUnits, balance_gross: gross, is_prepay: true };
  }
  if (spendCap > 0) {
    const remaining = Math.max(0, spendCap - amountSpent);
    return { balance_net: remaining, balance_gross: remaining, is_prepay: false };
  }
  return { balance_net: 0, balance_gross: 0, is_prepay: isPrepay };
}

export async function fetchPortalAccountBalances(
  db: Db,
  portalId: string,
  ownerUserId: string,
): Promise<{ balances: PortalAccountBalance[]; error?: string }> {
  const { data: portalAccounts, error: portalAccountsError } = await db
    .from("portal_accounts")
    .select("ad_account_id")
    .eq("portal_id", portalId);
  if (portalAccountsError) throw new Error(`Erro ao consultar contas do portal: ${portalAccountsError.message}`);
  const allowedAccountIds = (portalAccounts ?? []).map((row: { ad_account_id: string }) => row.ad_account_id);
  if (allowedAccountIds.length === 0) return { balances: [] };

  const { data: platformAccounts, error: platformAccountsError } = await db
    .from("ad_platform_accounts")
    .select("id, account_id, account_name")
    .eq("user_id", ownerUserId)
    .in("account_id", allowedAccountIds);
  if (platformAccountsError) throw new Error(`Erro ao consultar contas de anúncio: ${platformAccountsError.message}`);
  if (!platformAccounts?.length) return { balances: [] };

  const platformAccountIds = platformAccounts.map((row: { id: string }) => row.id);
  const { data: tokens, error: tokensError } = await db
    .from("meta_tokens")
    .select("platform_account_id, encrypted_token")
    .in("platform_account_id", platformAccountIds);
  if (tokensError) throw new Error(`Erro ao consultar credenciais da Meta: ${tokensError.message}`);
  if (!tokens?.length) return { balances: [], error: "Conta Meta não conectada" };

  const tokenMap = new Map<string, string>();
  for (const token of tokens) {
    try {
      tokenMap.set(token.platform_account_id, decryptToken(token.encrypted_token));
    } catch {
      // Uma credencial inválida não deve impedir a consulta das outras contas.
    }
  }
  if (tokenMap.size === 0) return { balances: [], error: "Token inválido ou expirado" };

  const fetchedAt = new Date().toISOString();
  const balances: PortalAccountBalance[] = [];
  for (const account of platformAccounts as { id: string; account_id: string; account_name: string }[]) {
    const token = tokenMap.get(account.id);
    if (!token) continue;
    try {
      const details = await getAdAccountDetails(account.account_id, token);
      const computed = computePortalAccountBalance(
        details.balance,
        details.amount_spent,
        details.spend_cap,
        details.funding_source_details?.type,
        details.currency,
      );
      balances.push({
        account_id: details.id,
        account_name: details.name,
        account_status: details.account_status,
        currency: details.currency,
        balance_gross: computed.balance_gross,
        balance_net: computed.balance_net,
        amount_spent: toUnit(details.amount_spent),
        funding_type: mapFundingType(details.funding_source_details?.type),
        funding_display: details.funding_source_details?.display_string ?? null,
        is_prepay: computed.is_prepay,
        fetched_at: fetchedAt,
      });
    } catch (error) {
      console.error(`[portal/balance] failed to fetch account ${account.account_id}:`, error);
      balances.push({
        account_id: account.account_id,
        account_name: account.account_name,
        account_status: 0,
        currency: "BRL",
        balance_gross: 0,
        balance_net: 0,
        amount_spent: 0,
        funding_type: "",
        funding_display: null,
        is_prepay: false,
        fetched_at: fetchedAt,
      });
    }
  }
  return { balances };
}
