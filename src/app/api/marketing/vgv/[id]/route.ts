import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

type Params = { params: Promise<{ id: string }> };

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
