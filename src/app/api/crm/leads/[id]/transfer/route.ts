import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { LeadService } from "@/lib/crm/lead-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: leadId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    stage_id?: string;
    note?: string;
    assignee_id?: string | null;
  };
  if (!body.stage_id) return NextResponse.json({ error: "stage_id é obrigatório" }, { status: 400 });

  const result = await new LeadService(supabase).copyLeadToPipeline(leadId, body.stage_id, {
    note: body.note,
    assigneeId: body.assignee_id ?? null,
    movedBy: user.id,
  });
  if (!result.ok) {
    const status = result.error === "Esta etapa exige uma observação" ? 422 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    lead_id: result.leadId,
    already_exists: result.alreadyExists,
  });
}
