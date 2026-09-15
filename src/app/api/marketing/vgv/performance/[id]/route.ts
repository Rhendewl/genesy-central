import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const db = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(db);
    const { id } = await params;
    const { data: current, error: currentError } = await db.from("marketing_vgv_campaign_performance").select("agency_client_id,campaign_name").eq("id", id).maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current) throw Object.assign(new Error("Campanha não encontrada"), { status: 404 });
    const body = await req.json() as Record<string, unknown>;
    const campaignName = String(body.campaign_name ?? "").trim().slice(0, 200);
    const spend = Number(body.spend); const leads = Number(body.leads);
    if (!body.agency_client_id || !campaignName || !validDate(body.period_start) || !validDate(body.period_end) || body.period_start! > body.period_end! || !Number.isFinite(spend) || spend < 0 || !Number.isInteger(leads) || leads < 0) throw Object.assign(new Error("Preencha cliente, campanha, período, investimento e leads corretamente"), { status: 400 });
    const { data: client } = await db.from("agency_clients").select("id,name").eq("id", String(body.agency_client_id)).maybeSingle();
    if (!client) throw Object.assign(new Error("Cliente inválido"), { status: 400 });
    const { data, error } = await db.from("marketing_vgv_campaign_performance").update({ organization_id: context.organizationId, agency_client_id: client.id, campaign_name: campaignName, development_name: String(body.development_name ?? "").trim().slice(0, 200) || null, period_start: body.period_start, period_end: body.period_end, spend, leads }).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    if (current.agency_client_id !== client.id || current.campaign_name !== campaignName) {
      const { error: linkedSalesError } = await db.from("marketing_vgv_sales").update({ agency_client_id: client.id, campaign_name: campaignName }).eq("agency_client_id", current.agency_client_id).eq("campaign_name", current.campaign_name);
      if (linkedSalesError) throw new Error(linkedSalesError.message);
    }
    return NextResponse.json({ performance: { ...data, client_name: client.name, spend: Number(data.spend), leads: Number(data.leads) } });
  } catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const db = await createServerSupabaseClient();
  try { await getMarketingServerContext(db); const { id } = await params; const { error } = await db.from("marketing_vgv_campaign_performance").delete().eq("id", id); if (error) throw new Error(error.message); return NextResponse.json({ success: true }); }
  catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}
