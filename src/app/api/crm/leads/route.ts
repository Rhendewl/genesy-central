import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { LeadService } from "@/lib/crm/lead-service";

interface CreateLeadBody {
  name?: string;
  contact?: string;
  stage_id?: string | null;
  assigned_to?: string | null;
  tags?: string[];
  notes?: string | null;
  integration_notes?: string | null;
  deal_value?: number;
  entered_at?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as CreateLeadBody | null;
  const name = body?.name?.trim();
  const contact = body?.contact?.trim();
  if (!name || !contact || !body?.stage_id) {
    return NextResponse.json(
      { error: "Nome, contato e etapa são obrigatórios" },
      { status: 400 },
    );
  }

  // Um login convidado pertence ao workspace indicado pelo próprio perfil.
  // A consulta em lista mantém esta rota defensiva durante a correção de
  // cadastros antigos que tenham recebido, por engano, uma segunda linha self.
  const { data: profiles, error: profileError } = await supabase
    .from("user_profiles")
    .select("owner_id, is_active")
    .eq("auth_user_id", user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const activeProfiles = (profiles ?? []).filter(profile => profile.is_active);
  const profile = activeProfiles.find(profile => profile.owner_id !== user.id) ?? activeProfiles[0];
  const ownerId = profile?.owner_id ?? user.id;

  const result = await new LeadService(supabase).createLead({
    user_id: ownerId,
    stageId: body.stage_id,
    name,
    contact,
    email: null,
    source: "manual",
    assigned_to: body.assigned_to ?? null,
    tags: Array.isArray(body.tags) ? body.tags : [],
    notes: body.notes?.trim() || null,
    integration_notes: body.integration_notes?.trim() || null,
    deal_value: Number.isFinite(body.deal_value) ? Number(body.deal_value) : 0,
    entered_at: body.entered_at,
  });

  if (!result.ok || !result.leadId) {
    return NextResponse.json({ error: result.error ?? "Erro ao criar lead" }, { status: 422 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", result.leadId)
    .single();

  if (leadError) {
    return NextResponse.json({ id: result.leadId }, { status: 201 });
  }

  return NextResponse.json({ lead }, { status: 201 });
}
