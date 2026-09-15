import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { parseMarketingVgvSaleInput } from "@/lib/marketing/domain";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const { data: sale, error: findError } = await supabase
      .from("marketing_vgv_sales")
      .select("id,created_by")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!sale) throw Object.assign(new Error("Venda não encontrada"), { status: 404 });
    if (!context.isAdmin && sale.created_by !== context.user.id) {
      throw Object.assign(new Error("Você não pode editar este registro"), { status: 403 });
    }
    const input = parseMarketingVgvSaleInput(await req.json().catch(() => null));
    if (input.agency_client_id) {
      const { data: client } = await supabase.from("agency_clients").select("id").eq("id", input.agency_client_id).maybeSingle();
      if (!client) throw Object.assign(new Error("Cliente inválido"), { status: 400 });
    }
    const { data, error } = await supabase
      .from("marketing_vgv_sales")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ sale: {
      ...data,
      sale_value: Number(data.sale_value),
      commission_percentage: Number(data.commission_percentage),
      agency_share_percentage: Number(data.agency_share_percentage ?? 100),
      custom_answers: data.custom_answers ?? {},
      can_edit: true,
      can_delete: true,
    } });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const { data: sale, error: findError } = await supabase
      .from("marketing_vgv_sales")
      .select("id,created_by")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!sale) throw Object.assign(new Error("Venda não encontrada"), { status: 404 });
    if (!context.isAdmin && sale.created_by !== context.user.id) {
      throw Object.assign(new Error("Você não pode apagar este registro"), { status: 403 });
    }
    const { error } = await supabase.from("marketing_vgv_sales").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
