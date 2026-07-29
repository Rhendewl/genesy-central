import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { parseMarketingVgvSaleInput } from "@/lib/marketing/domain";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import type { MarketingVgvSale } from "@/types/marketing";

export const dynamic = "force-dynamic";

function monthRange(value: string | null) {
  const month = value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  return { start: `${month}-01`, end: next };
}

function requestedRange(searchParams: URLSearchParams) {
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const isDate = (value: string | null) => !!value && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value);

  if (start !== null || end !== null) {
    if (!isDate(start) || !isDate(end) || start! >= end!) {
      throw Object.assign(new Error("Período inválido"), { status: 400 });
    }
    return { start: start!, end: end! };
  }

  return monthRange(searchParams.get("month"));
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const range = requestedRange(req.nextUrl.searchParams);
    const { data, error } = await supabase
      .from("marketing_vgv_sales")
      .select("*")
      .gte("sale_date", range.start)
      .lt("sale_date", range.end)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const sales = (data ?? []).map((row) => ({
      ...row,
      sale_value: Number(row.sale_value),
      commission_percentage: Number(row.commission_percentage),
      can_delete: context.isAdmin || row.created_by === context.user.id,
    })) as MarketingVgvSale[];
    return NextResponse.json({ sales });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const input = parseMarketingVgvSaleInput(await req.json().catch(() => null));
    const { data, error } = await supabase
      .from("marketing_vgv_sales")
      .insert({
        ...input,
        organization_id: context.organizationId,
        created_by: context.user.id,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({
      sale: {
        ...data,
        sale_value: Number(data.sale_value),
        commission_percentage: Number(data.commission_percentage),
        can_delete: true,
      },
    }, { status: 201 });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
