import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { LeadService } from "@/lib/crm/lead-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: leadId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as { stage_id?: string; note?: string };

  if (!body.stage_id) {
    return NextResponse.json({ error: "stage_id é obrigatório" }, { status: 400 });
  }

  const service = new LeadService(supabase);
  const result  = await service.moveLead(leadId, body.stage_id, {
    note:    body.note,
    movedBy: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, fromStageId: result.fromStageId });
}
