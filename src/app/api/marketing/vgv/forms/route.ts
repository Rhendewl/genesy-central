import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { normalizeVgvCustomFields } from "@/lib/marketing/vgv-intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await createServerSupabaseClient();
  try {
    await getMarketingServerContext(db);
    const { data, error } = await db.from("marketing_vgv_forms").select("*, client:agency_clients(name)").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ forms: (data ?? []).map((row) => ({ ...row, client_name: row.client?.name ?? "Cliente", default_commission_percentage: Number(row.default_commission_percentage), agency_share_percentage: Number(row.agency_share_percentage), client: undefined })) });
  } catch (error) {
    const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}

export async function POST(req: NextRequest) {
  const db = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(db);
    const body = await req.json() as Record<string, unknown>;
    const clientId = typeof body.agency_client_id === "string" ? body.agency_client_id : "";
    const { data: client } = await db.from("agency_clients").select("id,name").eq("id", clientId).maybeSingle();
    if (!client) throw Object.assign(new Error("Selecione um cliente válido"), { status: 400 });
    const commission = Number(body.default_commission_percentage ?? 0);
    const share = Number(body.agency_share_percentage ?? 0);
    if (![commission, share].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) throw Object.assign(new Error("Percentuais devem estar entre 0% e 100%"), { status: 400 });
    const { data, error } = await db.from("marketing_vgv_forms").insert({
      organization_id: context.organizationId,
      agency_client_id: client.id,
      name: String(body.name || `Registro de venda — ${client.name}`).trim().slice(0, 160),
      slug: `venda-${randomBytes(10).toString("hex")}`,
      default_commission_percentage: commission,
      include_agency_commission: body.include_agency_commission === true,
      agency_share_percentage: body.include_agency_commission === true ? share : 0,
      custom_fields: normalizeVgvCustomFields(body.custom_fields),
      created_by: context.user.id,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ form: { ...data, client_name: client.name, default_commission_percentage: Number(data.default_commission_percentage), agency_share_percentage: Number(data.agency_share_percentage) } }, { status: 201 });
  } catch (error) {
    const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
