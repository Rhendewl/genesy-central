export const dynamic    = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptToken } from "@/lib/crypto";
import {
  fetchAsaasPayments,
  fetchAsaasCustomers,
  type AsaasEnv,
} from "@/lib/asaas-api";

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapStatus(s: string): string {
  if (s === "RECEIVED" || s === "CONFIRMED") return "pago";
  if (s === "OVERDUE") return "atrasado";
  if (
    s === "CANCELED" || s === "REFUNDED" ||
    s.startsWith("CHARGEBACK") || s.startsWith("DUNNING") || s.startsWith("REFUND")
  ) return "cancelado";
  return "pendente";
}

function mapBillingType(t: string): string {
  if (t === "PIX") return "pix";
  if (t === "BOLETO") return "boleto";
  if (t === "CREDIT_CARD" || t === "DEBIT_CARD") return "cartao";
  if (t === "TRANSFER" || t === "DEPOSIT") return "ted";
  return "outro";
}

function detectType(desc: string): string {
  const l = desc.toLowerCase();
  if (l.includes("mensalidade") || l.includes("mensal") || l.includes("assinatura")) return "mensalidade";
  if (l.includes("setup") || l.includes("implantação") || l.includes("implantacao") || l.includes("ativação")) return "setup";
  if (l.includes("consultoria")) return "consultoria";
  if (l.includes("extra") || l.includes("adicional") || l.includes("avulso")) return "extra";
  return "outro";
}

// ─── POST /api/integrations/asaas/sync ────────────────────────────────────────

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    // ── Get integration record ────────────────────────────────────────────────
    const { data: integration } = await supabase
      .from("integrations")
      .select("api_key_encrypted, environment")
      .eq("user_id", user.id)
      .eq("provider", "asaas")
      .eq("status", "connected")
      .single();

    if (!integration) {
      return NextResponse.json(
        { error: "Integração Asaas não encontrada ou desconectada." },
        { status: 404 },
      );
    }

    const apiKey = decryptToken(integration.api_key_encrypted as string);
    const env    = integration.environment as AsaasEnv;

    // ── Fetch agency_clients for matching ─────────────────────────────────────
    const { data: agencyClients } = await supabase
      .from("agency_clients")
      .select("id, name, contact_email")
      .eq("user_id", user.id);

    const clientByName  = new Map<string, string>();
    const clientByEmail = new Map<string, string>();
    for (const c of agencyClients ?? []) {
      clientByName.set(c.name.toLowerCase().trim(), c.id as string);
      if (c.contact_email) {
        clientByEmail.set((c.contact_email as string).toLowerCase().trim(), c.id as string);
      }
    }

    // ── Fetch Asaas customers ─────────────────────────────────────────────────
    console.log("[asaas/sync] fetching customers...");
    const asaasCustomers   = await fetchAsaasCustomers(apiKey, env);
    const asaasCustomerMap = new Map(asaasCustomers.map(c => [c.id, c]));
    console.log(`[asaas/sync] ${asaasCustomers.length} customers loaded`);

    // ── Fetch all payments (paginated, max 500) ───────────────────────────────
    console.log("[asaas/sync] fetching payments...");
    const allPayments: Awaited<ReturnType<typeof fetchAsaasPayments>>["data"] = [];
    let offset = 0;

    while (allPayments.length < 500) {
      const page = await fetchAsaasPayments(apiKey, env, { offset, limit: 100 });
      const active = page.data.filter(p => !p.deleted);
      allPayments.push(...active);
      if (!page.hasMore) break;
      offset += 100;
    }

    console.log(`[asaas/sync] ${allPayments.length} payments fetched`);

    // ── Load existing synced revenues to detect add vs update ─────────────────
    const { data: existingRevenues } = await supabase
      .from("revenues")
      .select("id, asaas_payment_id")
      .eq("user_id", user.id)
      .not("asaas_payment_id", "is", null);

    const existingMap = new Map<string, string>(
      (existingRevenues ?? []).map(r => [r.asaas_payment_id as string, r.id as string]),
    );

    // ── Upsert revenues ───────────────────────────────────────────────────────
    let added = 0, updated = 0, skipped = 0;

    for (const payment of allPayments) {
      const customer = asaasCustomerMap.get(payment.customer);
      const clientId: string | null = customer
        ? (clientByName.get(customer.name.toLowerCase().trim())
            ?? (customer.email ? clientByEmail.get(customer.email.toLowerCase().trim()) : undefined)
            ?? null)
        : null;

      const description = payment.description?.trim()
        || (customer ? `${customer.name} — Cobrança Asaas` : "Cobrança Asaas");

      const status   = mapStatus(payment.status);
      const paidDate = status === "pago"
        ? (payment.paymentDate ?? payment.confirmedDate ?? null)
        : null;
      const date = paidDate ?? payment.dueDate ?? payment.dateCreated.slice(0, 10);

      const revenueData = {
        user_id:          user.id,
        client_id:        clientId,
        type:             detectType(description),
        description,
        amount:           payment.value,
        date,
        due_date:         payment.dueDate ?? null,
        paid_date:        paidDate,
        payment_method:   mapBillingType(payment.billingType),
        status,
        is_recurring:     false,
        asaas_payment_id: payment.id,
      };

      const existingId = existingMap.get(payment.id);
      if (existingId) {
        const { error } = await supabase
          .from("revenues")
          .update(revenueData)
          .eq("id", existingId);
        if (error) {
          console.error("[asaas/sync] update error:", error.message);
          skipped++;
        } else {
          updated++;
        }
      } else {
        const { error } = await supabase
          .from("revenues")
          .insert(revenueData);
        if (error) {
          console.error("[asaas/sync] insert error:", error.message);
          skipped++;
        } else {
          added++;
        }
      }
    }

    // ── Update last_sync_at ───────────────────────────────────────────────────
    await supabase
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("provider", "asaas");

    console.log(`[asaas/sync] done — added=${added} updated=${updated} skipped=${skipped}`);

    return NextResponse.json({
      success: true,
      total:   allPayments.length,
      added,
      updated,
      skipped,
    });
  } catch (err) {
    console.error("[asaas/sync]", err);
    return NextResponse.json({ error: "Erro interno durante sincronização." }, { status: 500 });
  }
}
