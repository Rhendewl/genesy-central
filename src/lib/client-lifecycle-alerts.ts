import { differenceInCalendarDays, format, getDaysInMonth, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { persistOperationalAlert } from "@/lib/notifications/operational-alert";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export const META_TOKEN_WARNING_DAYS = 7;
export const CONTRACT_WARNING_DAYS = 30;
export const PAYMENT_WARNING_DAYS = 3;

export function daysFromToday(date: string, today: string) {
  return differenceInCalendarDays(parseISO(date.slice(0, 10)), parseISO(today));
}

export function monthlyPaymentDate(today: string, paymentDay: number) {
  const base = parseISO(today);
  const build = (year: number, monthIndex: number) => {
    const monthStart = new Date(year, monthIndex, 1);
    const day = Math.min(paymentDay, getDaysInMonth(monthStart));
    return format(new Date(year, monthIndex, day), "yyyy-MM-dd");
  };
  const current = build(base.getFullYear(), base.getMonth());
  return current >= today ? current : build(base.getFullYear(), base.getMonth() + 1);
}

export function overdueReminderBucket(daysOverdue: number) {
  return Math.max(0, Math.floor((daysOverdue - 1) / 7));
}

type AlertRunResult = { checked: number; created: number; pushAccepted: number; errors: string[] };

export async function runClientLifecycleAlerts(db: Db, now = new Date()): Promise<AlertRunResult> {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Fortaleza" }).format(now).slice(0, 10);
  const result: AlertRunResult = { checked: 0, created: 0, pushAccepted: 0, errors: [] };

  async function notify(input: Parameters<typeof persistOperationalAlert>[1]) {
    result.checked++;
    try {
      const delivery = await persistOperationalAlert(db, input);
      result.created += delivery.created;
      result.pushAccepted += delivery.accepted;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido");
    }
  }

  const [{ data: tokens, error: tokenError }, { data: accounts, error: accountError }, { data: clients, error: clientError }, { data: contracts, error: contractError }, { data: revenues, error: revenueError }] = await Promise.all([
    db.from("meta_tokens").select("id,user_id,platform_account_id,token_expires_at").not("platform_account_id", "is", null).not("token_expires_at", "is", null),
    db.from("ad_platform_accounts").select("id,user_id,client_id,account_name,status").eq("platform", "meta"),
    db.from("agency_clients").select("id,user_id,name,status,contract_end,payment_day").eq("status", "ativo"),
    db.from("contracts").select("id,user_id,client_id,end_date,status").eq("status", "ativo").not("end_date", "is", null),
    db.from("revenues").select("id,user_id,client_id,description,due_date,status").in("status", ["pendente", "atrasado"]).not("due_date", "is", null).lt("due_date", today),
  ]);
  const queryError = tokenError ?? accountError ?? clientError ?? contractError ?? revenueError;
  if (queryError) throw new Error(queryError.message);

  const accountById = new Map((accounts ?? []).map((account) => [account.id as string, account]));
  const clientById = new Map((clients ?? []).map((client) => [client.id as string, client]));

  for (const token of tokens ?? []) {
    const account = accountById.get(token.platform_account_id);
    if (!account || account.status !== "connected") continue;
    const remaining = daysFromToday(token.token_expires_at, today);
    if (remaining < 0 || remaining > META_TOKEN_WARNING_DAYS) continue;
    const client = account.client_id ? clientById.get(account.client_id) : null;
    const expiryDate = token.token_expires_at.slice(0, 10);
    await notify({
      ownerUserId: token.user_id,
      roles: ["admin", "trafego"],
      eventId: `meta-token-expiry:${account.id}:${expiryDate}`,
      source: "meta_token",
      title: remaining === 0 ? "Token da Meta vence hoje" : `Token da Meta vence em ${remaining} dia${remaining === 1 ? "" : "s"}`,
      body: `${account.account_name}${client?.name ? `, de ${client.name}` : ""}, precisará ser reconectada para manter a sincronização e as automações funcionando.`,
      actionUrl: `/clientes?tab=area_clientes&area=analise_comercial${account.client_id ? `&meta_client=${account.client_id}` : ""}`,
    });
  }

  const contractsByClient = new Set<string>();
  for (const contract of contracts ?? []) {
    const remaining = daysFromToday(contract.end_date, today);
    if (remaining < 0 || remaining > CONTRACT_WARNING_DAYS) continue;
    const client = contract.client_id ? clientById.get(contract.client_id) : null;
    if (contract.client_id) contractsByClient.add(`${contract.client_id}:${contract.end_date}`);
    await notify({
      ownerUserId: contract.user_id,
      roles: ["admin", "financeiro"],
      eventId: `client-contract-expiry:${contract.id}:${contract.end_date}`,
      source: "client_contract",
      title: remaining === 0 ? "Contrato vence hoje" : `Contrato vence em ${remaining} dias`,
      body: `${client?.name ?? "Um cliente"} está próximo do fim do contrato em ${format(parseISO(contract.end_date), "dd/MM/yyyy")}. Programe a renovação.`,
      actionUrl: "/clientes",
    });
  }
  for (const client of clients ?? []) {
    if (!client.contract_end || contractsByClient.has(`${client.id}:${client.contract_end}`)) continue;
    const remaining = daysFromToday(client.contract_end, today);
    if (remaining < 0 || remaining > CONTRACT_WARNING_DAYS) continue;
    await notify({
      ownerUserId: client.user_id,
      roles: ["admin", "financeiro"],
      eventId: `client-contract-expiry:${client.id}:${client.contract_end}`,
      source: "client_contract",
      title: remaining === 0 ? "Contrato vence hoje" : `Contrato vence em ${remaining} dias`,
      body: `${client.name} está próximo do fim do contrato em ${format(parseISO(client.contract_end), "dd/MM/yyyy")}. Programe a renovação.`,
      actionUrl: "/clientes",
    });
  }

  for (const client of clients ?? []) {
    const dueDate = monthlyPaymentDate(today, Number(client.payment_day));
    if (daysFromToday(dueDate, today) !== PAYMENT_WARNING_DAYS) continue;
    await notify({
      ownerUserId: client.user_id,
      roles: ["admin", "financeiro"],
      eventId: `client-payment-upcoming:${client.id}:${dueDate}`,
      source: "client_payment",
      title: "Pagamento previsto em 3 dias",
      body: `O pagamento de ${client.name} está previsto para ${format(parseISO(dueDate), "dd/MM")}. Prepare e gere a nota fiscal.`,
      actionUrl: "/financeiro?tab=receitas",
    });
  }

  for (const revenue of revenues ?? []) {
    const daysOverdue = Math.abs(daysFromToday(revenue.due_date, today));
    const client = revenue.client_id ? clientById.get(revenue.client_id) : null;
    await notify({
      ownerUserId: revenue.user_id,
      roles: ["admin", "financeiro"],
      eventId: `client-payment-overdue:${revenue.id}:${overdueReminderBucket(daysOverdue)}`,
      source: "client_payment_overdue",
      title: `Pagamento atrasado há ${daysOverdue} dia${daysOverdue === 1 ? "" : "s"}`,
      body: `${client?.name ?? revenue.description} possui um pagamento vencido desde ${format(parseISO(revenue.due_date), "dd/MM/yyyy")}. Verifique a cobrança e a nota fiscal.`,
      actionUrl: "/financeiro?tab=inadimplencia",
    });
  }

  return result;
}
