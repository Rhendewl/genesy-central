import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { MARKETING_CONTENT_STATUSES, type MarketingContentStatus } from "@/types/marketing";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const status = body?.status;
    if (typeof status !== "string" || !MARKETING_CONTENT_STATUSES.includes(status as MarketingContentStatus)) {
      throw Object.assign(new Error("Status de publicação inválido"), { status: 400 });
    }
    const publishedAt = body?.published_at;
    if (publishedAt !== null && (typeof publishedAt !== "string" || Number.isNaN(Date.parse(publishedAt)))) {
      throw Object.assign(new Error("Data de publicação inválida"), { status: 400 });
    }
    const { data, error } = await supabase
      .from("marketing_contents")
      .update({
        status,
        published_at: publishedAt,
        manual_publication: body?.manual_publication === true,
        updated_by: context.user.id,
      })
      .eq("id", id)
      .select("id,status,published_at,manual_publication,updated_at,updated_by")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ content: data });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
