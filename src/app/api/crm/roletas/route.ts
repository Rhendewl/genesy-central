import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { distributeFormLead } from "@/lib/crm/lead-roulette";
import { collaborationError, fail, privateHeaders, smallBody, UUID } from "@/lib/crm/lead-collaboration-server";

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
    // Explicit owner filters are required even for these admin-only lookups.
    const admin = createAdminSupabaseClient();
    const results = await Promise.all([
      db.from("crm_lead_roulettes").select("*").order("created_at"),
      admin.from("forms").select("id,name").eq("user_id", ownerId).is("deleted_at", null).order("name"),
      admin.from("meta_form_subscriptions").select("form_id,form_name,page_id,is_active").eq("user_id", ownerId),
      db.from("crm_pipelines").select("id,name,is_active,default_assignee_id,crm_stages(id,name,is_active,order_index)").order("order_index"),
      db.from("crm_lead_distribution").select("id,roulette_id,status,lead_id,pipeline_id,assigned_to,created_at,distributed_at").order("created_at", { ascending: false }).limit(100),
      admin.from("user_profiles").select("id,full_name,is_active,auth_user_id").eq("owner_id", ownerId),
      db.from("crm_lead_distribution").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    const resources = ["roletas", "formulários Genesy", "formulários Meta", "pipelines", "histórico de distribuição", "responsáveis", "entradas pendentes"];
    const failedIndex = results.findIndex(result => result.error);
    if (failedIndex >= 0) {
      const error = results[failedIndex].error!;
      console.error("[crm/roletas] Falha de leitura", { resource: resources[failedIndex], code: error.code, message: error.message });
      fail(`Não foi possível carregar ${resources[failedIndex]}. Tente novamente. Código: ${error.code || "indisponível"}.`, 503);
    }
    const [roulettes, forms, metaForms, pipelines, history, profiles, pending] = results;
    return NextResponse.json({ roulettes: roulettes.data, forms: forms.data, metaForms: metaForms.data,
      pipelines: pipelines.data, history: history.data, profiles: profiles.data, pendingCount: pending.count }, { headers: privateHeaders });
  } catch (error) { return collaborationError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const { db, ownerId } = await context();
    const body = await smallBody(req);
    if (body.action === "toggle" || body.action === "delete") {
      if (typeof body.id !== "string" || !UUID.test(body.id) || (body.action === "toggle" && typeof body.enabled !== "boolean")) fail("Roleta inválida.");
      const { error } = await db.rpc("crm_set_roulette_state", {
        p_id: body.id, p_enabled: body.action === "toggle" ? body.enabled : null, p_delete: body.action === "delete",
      });
      if (error) fail(error.message);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "retry") {
      if (typeof body.id !== "string" || !UUID.test(body.id)) fail("Roleta inválida.");
      const { data: roulette, error } = await db.from("crm_lead_roulettes").select("*").eq("id", body.id).is("deleted_at", null).single();
      if (error || !roulette) fail("Roleta não encontrada.", 404);
      if (!roulette.enabled) fail("Ative a roleta antes de reprocessar.");
      const pending = await db.from("crm_lead_distribution").select("event_id").eq("roulette_id", roulette.id)
        .eq("status", "pending").order("created_at").limit(25);
      if (pending.error) fail("Não foi possível consultar as pendências.", 503);
      const admin = createAdminSupabaseClient();
      let distributed = 0;
      for (const receipt of pending.data ?? []) {
        const result = await distributeFormLead(admin, { ownerId, source: roulette.source_kind, formId: roulette.form_id,
          pageId: roulette.page_id, eventId: receipt.event_id, payload: null });
        if (result.status === "pending") break;
        if (result.status === "distributed") distributed++;
      }
      return NextResponse.json({ distributed });
    }
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120 ||
      !["genesy", "meta"].includes(String(body.source_kind)) || typeof body.form_id !== "string" || !body.form_id ||
      typeof body.enabled !== "boolean" || !Array.isArray(body.stage_ids) || !body.stage_ids.length || body.stage_ids.length > 100 ||
      body.stage_ids.some(id => typeof id !== "string" || !UUID.test(id)) ||
      (body.id != null && (typeof body.id !== "string" || !UUID.test(body.id)))) fail("Confira o nome, formulário e as etapas da roleta.");
    const { data, error } = await db.rpc("crm_save_lead_roulette", {
      p_id: body.id ?? null, p_name: body.name, p_source: body.source_kind, p_form: body.form_id,
      p_page: typeof body.page_id === "string" ? body.page_id : "", p_stages: body.stage_ids, p_enabled: body.enabled,
    });
    if (error) fail(error.code === "23505" ? "Este formulário já possui uma roleta. Edite a configuração existente." : error.message);
    return NextResponse.json({ id: data });
  } catch (error) { return collaborationError(error); }
}
