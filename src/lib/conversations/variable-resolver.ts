// ── Variable resolver ──────────────────────────────────────────────────────
// Ponto único de substituição de variáveis {{namespace.campo}} nas mensagens
// de WhatsApp disparadas por fluxos. Nenhuma substituição improvisada deve
// acontecer no componente visual ou no provider — sempre passa por aqui.

type Db = ReturnType<typeof import("@/lib/supabase-admin").createAdminSupabaseClient>;

export interface FlowVariableContext {
  leadId: string | null;
  ownerProfileId: string | null;
  snapshot: Record<string, unknown>;
}

type LeadRow = {
  name: string;
  contact: string;
  email: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  assigned_to: string | null;
};

type BookingRow = {
  starts_at: string;
  meeting_url: string | null;
  location: string | null;
};

function snapshotString(snapshot: Record<string, unknown>, key: string): string {
  const value = snapshot[key];
  return typeof value === "string" ? value : "";
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// Monta o mapa "namespace.campo" -> valor. Prefere dados ao vivo (lead,
// agendamento) quando houver leadId/booking_id disponível — mais atual que o
// snapshot congelado no momento em que o job foi criado — com fallback pro
// snapshot quando não há registro vivo para consultar.
export async function resolveFlowVariables(db: Db, ctx: FlowVariableContext): Promise<Record<string, string>> {
  const vars: Record<string, string> = {
    "lead.nome": snapshotString(ctx.snapshot, "lead_name") || snapshotString(ctx.snapshot, "visitor_name"),
    "lead.primeiro_nome": "",
    "lead.email": snapshotString(ctx.snapshot, "lead_email") || snapshotString(ctx.snapshot, "visitor_email"),
    "lead.telefone": snapshotString(ctx.snapshot, "lead_phone") || snapshotString(ctx.snapshot, "visitor_phone") || snapshotString(ctx.snapshot, "from"),
    "formulario.nome": snapshotString(ctx.snapshot, "form_name"),
    "calendario.nome": snapshotString(ctx.snapshot, "calendar_name"),
    "reuniao.data": "",
    "reuniao.hora": "",
    "reuniao.link": "",
    "pipeline.nome": "",
    "etapa.nome": "",
    "responsavel.nome": "",
  };

  let pipelineId: string | null = null;
  let stageId: string | null = null;
  let assignedTo: string | null = null;

  if (ctx.leadId) {
    const { data: lead } = await db
      .from("leads")
      .select("name,contact,email,pipeline_id,stage_id,assigned_to")
      .eq("id", ctx.leadId)
      .maybeSingle<LeadRow>();

    if (lead) {
      if (lead.name) vars["lead.nome"] = lead.name;
      if (lead.contact) vars["lead.telefone"] = lead.contact;
      if (lead.email) vars["lead.email"] = lead.email;
      pipelineId = lead.pipeline_id;
      stageId = lead.stage_id;
      assignedTo = lead.assigned_to;
    }
  }

  vars["lead.primeiro_nome"] = firstName(vars["lead.nome"]);

  const bookingId = snapshotString(ctx.snapshot, "booking_id");
  if (bookingId) {
    const { data: booking } = await db
      .from("appointment_bookings")
      .select("starts_at,meeting_url,location")
      .eq("id", bookingId)
      .maybeSingle<BookingRow>();

    if (booking) {
      const startsAt = new Date(booking.starts_at);
      vars["reuniao.data"] = `${pad2(startsAt.getDate())}/${pad2(startsAt.getMonth() + 1)}/${startsAt.getFullYear()}`;
      vars["reuniao.hora"] = `${pad2(startsAt.getHours())}:${pad2(startsAt.getMinutes())}`;
      vars["reuniao.link"] = booking.meeting_url || booking.location || "";
    }
  }

  if (pipelineId) {
    const { data: pipeline } = await db
      .from("crm_pipelines")
      .select("name")
      .eq("id", pipelineId)
      .maybeSingle<{ name: string }>();
    vars["pipeline.nome"] = pipeline?.name ?? "";
  }

  if (stageId) {
    const { data: stage } = await db
      .from("crm_stages")
      .select("name")
      .eq("id", stageId)
      .maybeSingle<{ name: string }>();
    vars["etapa.nome"] = stage?.name ?? "";
  }

  const responsavelId = assignedTo ?? ctx.ownerProfileId;
  if (responsavelId) {
    const { data: profile } = await db
      .from("user_profiles")
      .select("full_name")
      .eq("id", responsavelId)
      .maybeSingle<{ full_name: string }>();
    vars["responsavel.nome"] = profile?.full_name ?? "";
  }

  return vars;
}

// Substitui {{namespace.campo}}. Variável ausente ou vazia vira string vazia
// (nunca deixa o token cru na mensagem enviada) — os nomes das que faltaram
// voltam em `missing` para o chamador logar como aviso, sem bloquear o envio.
export function renderTemplate(template: string, vars: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>();

  const text = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (!value) {
      missing.add(key);
      return "";
    }
    return value;
  });

  return { text, missing: Array.from(missing) };
}
