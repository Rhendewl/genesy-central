import type { SupabaseClient } from "@supabase/supabase-js";
import { persistOperationalAlert } from "@/lib/notifications/operational-alert";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

const MARKETING_NOTIFICATION_ROLES = ["admin"];
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Corretor";
}

export function vgvSaleNotification(input: {
  brokerName: string;
  clientName: string;
  developmentName: string;
  saleValue: number;
}) {
  return {
    title: "Novo imóvel vendido",
    body: `${input.brokerName} registrou uma venda de ${brl.format(input.saleValue)} para ${input.clientName} · ${input.developmentName}.`,
  };
}

export function commercialAnalysisNotification(input: {
  brokerName: string;
  clientName: string;
  developmentName: string;
}) {
  return {
    title: `${firstName(input.brokerName)} respondeu análise comercial · ${input.clientName}`,
    body: `Empreendimento analisado: ${input.developmentName}.`,
  };
}

export async function notifyVgvSale(db: Db, input: {
  ownerUserId: string;
  saleId: string;
  brokerName: string;
  clientName: string;
  developmentName: string;
  saleValue: number;
}) {
  const content = vgvSaleNotification(input);
  return persistOperationalAlert(db, {
    ownerUserId: input.ownerUserId,
    roles: MARKETING_NOTIFICATION_ROLES,
    eventId: `vgv-sale:${input.saleId}`,
    source: "marketing_vgv_sale",
    ...content,
    actionUrl: "/clientes?tab=vgv",
  });
}

export async function notifyCommercialAnalysisResponse(db: Db, input: {
  ownerUserId: string;
  responseId: string;
  brokerName: string;
  clientName: string;
  clientId: string;
  developmentName: string;
}) {
  const content = commercialAnalysisNotification(input);
  return persistOperationalAlert(db, {
    ownerUserId: input.ownerUserId,
    roles: MARKETING_NOTIFICATION_ROLES,
    eventId: `commercial-analysis-response:${input.responseId}`,
    source: "commercial_analysis_response",
    ...content,
    actionUrl: `/clientes?tab=analise_comercial&client_id=${input.clientId}`,
  });
}
