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
    20: "Saldo pré-pago",
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

/**
 * Manual-funding accounts currently expose the actual available balance only
 * inside funding_source_details.display_string (for example
 * "Saldo disponível (R$882,81 BRL)").
 */
export function parseFundingDisplayBalance(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function computePortalAccountBalance(
  balanceRaw: string,
  amountSpentRaw: string,
  spendCapRaw: string,
  fundingType: number | string | undefined,
  currency: string,
  fundingDisplay?: string | null,
) {
  const balanceUnits = toUnit(balanceRaw);
  const amountSpent = toUnit(amountSpentRaw);
  const spendCap = toUnit(spendCapRaw);
  const fundingCode = typeof fundingType === "string" ? parseInt(fundingType, 10) : (fundingType ?? -1);
  const isPrepay = fundingCode === 2
    || fundingCode === 4
    || fundingCode === 20
    || fundingType === "PREPAY";

  if (isPrepay) {
    const displayBalance = currency === "BRL" ? parseFundingDisplayBalance(fundingDisplay) : null;
    const net = displayBalance ?? balanceUnits;
    const gross = currency === "BRL" ? net / (1 - META_BR_TAX_RATE) : net;
    return { balance_net: net, balance_gross: gross, is_prepay: true };
  }
  if (spendCap > 0) {
    const remaining = Math.max(0, spendCap - amountSpent);
    return { balance_net: remaining, balance_gross: remaining, is_prepay: false };
  }
  return { balance_net: 0, balance_gross: 0, is_prepay: isPrepay };
}

async function fetchBalancesForAccounts(
  db: Db,
  ownerUserId: string,
  allowedAccountIds?: string[],
): Promise<{ balances: PortalAccountBalance[]; errors: Array<{ account_id: string; account_name: string; error: string }> }> {
  let accountsQuery = db
    .from("ad_platform_accounts")
    .select("id, account_id, account_name")
    .eq("user_id", ownerUserId)
    .eq("platform", "meta")
    .eq("status", "connected")
    .not("account_id", "is", null);
  if (allowedAccountIds) accountsQuery = accountsQuery.in("account_id", allowedAccountIds);

  const { data: platformAccounts, error: platformAccountsError } = await accountsQuery;
  if (platformAccountsError) throw new Error(`Erro ao consultar contas de anúncio: ${platformAccountsError.message}`);
  if (!platformAccounts?.length) return { balances: [], errors: [] };

  const platformAccountIds = platformAccounts.map((row: { id: string }) => row.id);
  const { data: tokens, error: tokensError } = await db
    .from("meta_tokens")
    .select("platform_account_id, encrypted_token")
    .in("platform_account_id", platformAccountIds);
  if (tokensError) throw new Error(`Erro ao consultar credenciais da Meta: ${tokensError.message}`);

  const tokenMap = new Map<string, string>();
  for (const token of tokens ?? []) {
    try {
      tokenMap.set(token.platform_account_id, decryptToken(token.encrypted_token));
    } catch {
      // Uma credencial inválida não deve impedir a consulta das outras contas.
    }
  }

  const fetchedAt = new Date().toISOString();
  const balances: PortalAccountBalance[] = [];
  const errors: Array<{ account_id: string; account_name: string; error: string }> = [];
  for (const account of platformAccounts as { id: string; account_id: string; account_name: string }[]) {
    const token = tokenMap.get(account.id);
    if (!token) {
      errors.push({ account_id: account.account_id, account_name: account.account_name, error: "Conta Meta não conectada" });
      continue;
    }
    try {
      const details = await getAdAccountDetails(account.account_id, token);
      const computed = computePortalAccountBalance(
        details.balance,
        details.amount_spent,
        details.spend_cap,
        details.funding_source_details?.type,
        details.currency,
        details.funding_source_details?.display_string,
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
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      console.error(`[portal/balance] failed to fetch account ${account.account_id}:`, error);
      errors.push({ account_id: account.account_id, account_name: account.account_name, error: message });
    }
  }
  return { balances, errors };
}

export async function fetchAllAccountBalances(
  db: Db,
  ownerUserId: string,
): Promise<{ balances: PortalAccountBalance[]; errors: Array<{ account_id: string; account_name: string; error: string }> }> {
  return fetchBalancesForAccounts(db, ownerUserId);
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

  const result = await fetchBalancesForAccounts(db, ownerUserId, allowedAccountIds);
  return {
    balances: result.balances,
    ...(result.errors.length > 0 && result.balances.length === 0
      ? { error: result.errors.map(item => `${item.account_name}: ${item.error}`).join("; ") }
      : {}),
  };
}
