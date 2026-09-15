import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { normalizeVgvCustomFields } from "@/lib/marketing/vgv-intelligence";
import { notifyVgvSale } from "@/lib/notifications/marketing-alerts";

export const dynamic = "force-dynamic";

async function findForm(slug: string) {
  const db = createAdminSupabaseClient();
  const { data, error } = await db.from("marketing_vgv_forms").select("*, client:agency_clients(name)").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return { db, form: data };
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { form } = await findForm(params.slug);
    if (!form) return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });
    if (form.status !== "active") return NextResponse.json({ error: "Este formulário está temporariamente pausado" }, { status: 410 });
    // Financial rules intentionally never leave the server.
    return NextResponse.json({ form: { name: form.name, client_name: form.client?.name ?? "", custom_fields: normalizeVgvCustomFields(form.custom_fields) } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível abrir o formulário" }, { status: 500 }); }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json() as Record<string, unknown>;
    if (body.website) return NextResponse.json({ success: true }, { status: 201 });
    const { db, form } = await findForm(params.slug);
    if (!form || form.status !== "active") return NextResponse.json({ error: "Formulário indisponível" }, { status: 404 });
    const brokerName = String(body.broker_name ?? "").trim().slice(0, 160);
    const buyerName = String(body.buyer_name ?? "").trim().slice(0, 160);
    const campaignName = String(body.campaign_name ?? "").trim().slice(0, 200);
    const developmentName = String(body.development_name ?? "").trim().slice(0, 200);
    const saleValue = Number(body.sale_value);
    const saleDate = String(body.sale_date ?? "");
    if (!brokerName || !buyerName || !campaignName || !developmentName || !Number.isFinite(saleValue) || saleValue <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) return NextResponse.json({ error: "Preencha todas as informações obrigatórias" }, { status: 400 });

    const fields = normalizeVgvCustomFields(form.custom_fields);
    const submitted = body.custom_answers && typeof body.custom_answers === "object" ? body.custom_answers as Record<string, unknown> : {};
    const customAnswers: Record<string, string | number> = {};
    for (const field of fields) {
      const raw = submitted[field.id];
      if (field.required && (raw === undefined || raw === null || String(raw).trim() === "")) return NextResponse.json({ error: `Responda: ${field.label}` }, { status: 400 });
      if (raw === undefined || raw === null || String(raw).trim() === "") continue;
      if (field.type === "number") {
        const value = Number(raw);
        if (!Number.isFinite(value)) return NextResponse.json({ error: `${field.label} precisa ser um número` }, { status: 400 });
        customAnswers[field.id] = value;
      } else customAnswers[field.id] = String(raw).trim().slice(0, 500);
    }

    const { data: sale, error } = await db.from("marketing_vgv_sales").insert({
      organization_id: form.organization_id,
      agency_client_id: form.agency_client_id,
      sale_value: Math.round(saleValue * 100) / 100,
      broker_name: brokerName,
      client_name: buyerName,
      buyer_name: buyerName,
      campaign_name: campaignName,
      development_name: developmentName,
      commission_percentage: Number(form.default_commission_percentage),
      include_agency_commission: form.include_agency_commission,
      agency_share_percentage: Number(form.agency_share_percentage),
      sale_date: saleDate,
      source: "form",
      form_id: form.id,
      custom_answers: customAnswers,
      created_by: form.created_by,
    }).select("id").single();
    if (error) throw error;
    try {
      await notifyVgvSale(db, {
        ownerUserId: form.organization_id,
        saleId: sale.id,
        brokerName,
        clientName: form.client?.name ?? "Cliente",
        developmentName,
        saleValue,
      });
    } catch (notificationError) {
      console.error("[public/vgv] venda registrada, mas a notificação falhou", notificationError);
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[public/vgv]", error);
    return NextResponse.json({ error: "Não foi possível registrar a venda" }, { status: 500 });
  }
}
