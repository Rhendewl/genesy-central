import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(req: NextRequest) {
  const db = await createServerSupabaseClient();
  try {
    await getMarketingServerContext(db);
    const includeAll = req.nextUrl.searchParams.get("all") === "true";
    const start = req.nextUrl.searchParams.get("start"); const end = req.nextUrl.searchParams.get("end");
    if (!includeAll && (!validDate(start) || !validDate(end))) throw Object.assign(new Error("Período inválido"), { status: 400 });
    let query = db.from("marketing_vgv_campaign_performance").select("*, client:agency_clients(name)");
    if (!includeAll) query = query.lt("period_start", end!).gte("period_end", start!);
    const { data, error } = await query.order("period_start", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ performance: (data ?? []).map((row) => ({ ...row, client_name: row.client?.name ?? "Cliente", spend: Number(row.spend), leads: Number(row.leads), client: undefined })) });
  } catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}

export async function POST(req: NextRequest) {
  const db = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(db);
    const body = await req.json() as Record<string, unknown>;
    const campaignName = String(body.campaign_name ?? "").trim().slice(0, 200);
    const spend = Number(body.spend); const leads = Number(body.leads);
    if (!body.agency_client_id || !campaignName || !validDate(body.period_start) || !validDate(body.period_end) || body.period_start! > body.period_end! || !Number.isFinite(spend) || spend < 0 || !Number.isInteger(leads) || leads < 0) throw Object.assign(new Error("Preencha cliente, campanha, período, investimento e leads corretamente"), { status: 400 });
    const { data: client } = await db.from("agency_clients").select("id,name").eq("id", String(body.agency_client_id)).maybeSingle();
    if (!client) throw Object.assign(new Error("Cliente inválido"), { status: 400 });
    const { data, error } = await db.from("marketing_vgv_campaign_performance").insert({ organization_id: context.organizationId, agency_client_id: client.id, campaign_name: campaignName, development_name: String(body.development_name ?? "").trim().slice(0, 200) || null, period_start: body.period_start, period_end: body.period_end, spend, leads, created_by: context.user.id }).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ performance: { ...data, client_name: client.name, spend: Number(data.spend), leads: Number(data.leads) } }, { status: 201 });
  } catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}
