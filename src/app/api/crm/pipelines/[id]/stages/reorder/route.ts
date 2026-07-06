import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

// PUT /api/crm/pipelines/[id]/stages/reorder
// Body: { order: string[] }  — array de stage IDs na nova ordem
// Persiste order_index = posição no array para cada stage do pipeline.
export async function PUT(req: NextRequest, { params }: Params) {
  const { id: pipelineId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as { order?: unknown };
  if (!Array.isArray(body.order)) {
    return NextResponse.json({ error: "order deve ser um array de IDs" }, { status: 400 });
  }

  const order = body.order as string[];

  if (order.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Verify pipeline exists (e é visível ao chamador — a RLS já garante isso)
  const { data: pipeline } = await supabase
    .from("crm_pipelines")
    .select("id")
    .eq("id", pipelineId)
    .maybeSingle();

  if (!pipeline) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });

  // Batch update: each stage gets order_index = its position in the array.
  // Double-keyed on (id, pipeline_id) — safe against cross-pipeline manipulation;
  // a RLS garante que só stages da própria organização são afetados.
  //
  // .select("id") is intentional: without it, Supabase returns { data: null, error: null }
  // for both successful updates AND 0-row matches (stage ID not found or wrong pipeline).
  // With .select("id"), successful updates return the updated row; 0-row matches return [].
  // This lets us distinguish "updated" from "silently did nothing" and avoid returning { ok: true }
  // when the reorder was actually incomplete.
  const results = await Promise.all(
    order.map((stageId, index) =>
      supabase
        .from("crm_stages")
        .update({ order_index: index })
        .eq("id", stageId)
        .eq("pipeline_id", pipelineId)
        .select("id"),
    ),
  );

  for (const result of results) {
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    if (!result.data || result.data.length !== 1) {
      return NextResponse.json(
        { error: "Uma ou mais etapas não pertencem a este pipeline ou não foram encontradas" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
