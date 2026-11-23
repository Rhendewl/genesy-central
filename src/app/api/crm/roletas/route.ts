import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { distributeFormLead } from "@/lib/crm/lead-roulette";
import { collaborationError, fail, privateHeaders, smallBody, UUID } from "@/lib/crm/lead-collaboration-server";

// Roletas organizadas em ambientes (ex.: um por cliente) com filas de distribuição.
async function context() {
  const db = await createServerSupabaseClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) fail("Faça login novamente.", 401);
  const permission = await db.rpc("current_member_has_full_crm_access");
  if (permission.error || permission.data !== true) fail("Apenas administradores podem configurar roletas.", 403);
  const owner = await db.rpc("effective_owner_id");
  if (owner.error || !owner.data) fail("Conta não encontrada.", 403);
  return { db, ownerId: owner.data as string };
}

export async function GET() {
  try {
    const { db, ownerId } = await context();
    const admin = createAdminSupabaseClient();
    const results = await Promise.all([
      db.from("crm_roulette_groups").select("id,name,created_at").is("deleted_at", null).order("created_at"),
      db.from("crm_lead_roulettes").select("id,group_id,name,enabled,participants,cursor_position,created_at").is("deleted_at", null).order("created_at"),
      db.from("crm_roulette_forms").select("roulette_id,source_kind,form_id,page_id"),
      admin.from("forms").select("id,name").eq("user_id", ownerId).is("deleted_at", null).order("name"),
      admin.from("meta_form_subscriptions").select("form_id,form_name,page_id,is_active").eq("user_id", ownerId),
      db.from("crm_pipelines").select("id,name,is_active,default_assignee_id,crm_stages(id,name,is_active,order_index)").order("order_index"),
      db.from("crm_lead_distribution").select("id,roulette_id,status,lead_id,pipeline_id,assigned_to,form_id,created_at,distributed_at").order("created_at", { ascending: false }).limit(200),
      admin.from("user_profiles").select("id,full_name,avatar_url,role,is_active,auth_user_id,crm_pipeline_id").eq("owner_id", ownerId),
    ]);
    const resources = ["ambientes", "filas", "formulários das filas", "formulários Genesy", "formulários Meta", "pipelines", "histórico de distribuição", "corretores"];
    const failedIndex = results.findIndex(result => result.error);
    if (failedIndex >= 0) {
      const error = results[failedIndex].error!;
      console.error("[crm/roletas] Falha de leitura", { resource: resources[failedIndex], code: error.code, message: error.message });
      fail(`Não foi possível carregar ${resources[failedIndex]}. Tente novamente. Código: ${error.code || "indisponível"}.`, 503);
    }
    const [groups, queues, links, forms, metaForms, pipelines, history, profiles] = results;
    return NextResponse.json({
      groups: groups.data, queues: queues.data, links: links.data, forms: forms.data, metaForms: metaForms.data,
      pipelines: pipelines.data, history: history.data, profiles: profiles.data,
    }, { headers: privateHeaders });
  } catch (error) { return collaborationError(error); }
}

const id = (value: unknown) => typeof value === "string" && UUID.test(value);

export async function POST(req: NextRequest) {
  try {
    const { db, ownerId } = await context();
    const body = await smallBody(req);
    switch (body.action) {
      case "save_group": {
        if (body.id != null && !id(body.id)) fail("Ambiente inválido.");
        if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) fail("Informe o nome do ambiente.");
        const { data, error } = await db.rpc("crm_save_roulette_group", { p_id: body.id ?? null, p_name: body.name });
        if (error) fail(error.message);
        return NextResponse.json({ id: data });
      }
      case "delete_group": {
        if (!id(body.id)) fail("Ambiente inválido.");
        const { error } = await db.rpc("crm_delete_roulette_group", { p_id: body.id });
        if (error) fail(error.message);
        return NextResponse.json({ ok: true });
      }
      case "save_queue": {
        if ((body.id != null && !id(body.id)) || !id(body.group_id)) fail("Fila inválida.");
        if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) fail("Informe o nome da fila.");
        const forms = Array.isArray(body.forms) ? body.forms : [];
        const participants = Array.isArray(body.participants) ? body.participants : [];
        if (!participants.length || participants.length > 100) fail("Escolha pelo menos um corretor.");
        if (forms.length > 200) fail("Muitos formulários em uma fila.");
        const cleanForms = forms.map(raw => {
          const form = raw as Record<string, unknown>;
          if (!["genesy", "meta"].includes(String(form.source_kind)) || typeof form.form_id !== "string" || !form.form_id) fail("Formulário inválido.");
          return { source_kind: form.source_kind, form_id: form.form_id, page_id: typeof form.page_id === "string" ? form.page_id : "" };
        });
        const cleanParticipants = participants.map(raw => {
          const item = raw as Record<string, unknown>;
          if (!id(item.profile_id) || !id(item.stage_id)) fail("Escolha a etapa de entrada de cada corretor.");
          return { profile_id: item.profile_id, stage_id: item.stage_id };
        });
        const { data, error } = await db.rpc("crm_save_roulette_queue", {
          p_id: body.id ?? null, p_group: body.group_id, p_name: body.name, p_enabled: body.enabled !== false,
          p_forms: cleanForms, p_participants: cleanParticipants,
        });
        if (error) fail(error.message);
        return NextResponse.json({ id: data });
      }
      case "toggle":
      case "delete": {
        if (!id(body.id) || (body.action === "toggle" && typeof body.enabled !== "boolean")) fail("Fila inválida.");
        const { error } = await db.rpc("crm_set_roulette_state", {
          p_id: body.id, p_enabled: body.action === "toggle" ? body.enabled : null, p_delete: body.action === "delete",
        });
        if (error) fail(error.message);
        return NextResponse.json({ ok: true });
      }
      case "retry": {
        if (!id(body.id)) fail("Fila inválida.");
        const { data: queue, error } = await db.from("crm_lead_roulettes").select("id,enabled").eq("id", body.id).is("deleted_at", null).single();
        if (error || !queue) fail("Fila não encontrada.", 404);
        if (!queue.enabled) fail("Ative a fila antes de reprocessar.");
        const pending = await db.from("crm_lead_distribution").select("event_id,source_kind,form_id,page_id").eq("roulette_id", queue.id)
          .eq("status", "pending").order("created_at").limit(25);
        if (pending.error) fail("Não foi possível consultar as pendências.", 503);
        const admin = createAdminSupabaseClient();
        let distributed = 0;
        for (const receipt of pending.data ?? []) {
          if (!receipt.form_id || !receipt.source_kind) continue;
          const result = await distributeFormLead(admin, { ownerId, source: receipt.source_kind as "genesy" | "meta", formId: receipt.form_id,
            pageId: receipt.page_id ?? "", eventId: receipt.event_id, payload: null });
          if (result.status === "pending") break;
          if (result.status === "distributed") distributed++;
        }
        return NextResponse.json({ distributed });
      }
      default:
        fail("Ação inválida.");
    }
  } catch (error) { return collaborationError(error); }
}
