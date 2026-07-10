import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Form } from "@/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ClientRow = {
  id: string;
  name: string;
};

function normalizeSlug(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateNpsSlug(clientName: string): string {
  const base = normalizeSlug(`nps-${clientName}`);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

type NpsIntegrationRow = {
  settings: { client_id: string; nps_step_id: string; notify_on_response: boolean };
  form_id: string;
};

// POST /api/clientes/[id]/nps-form/duplicate — duplica o formulário de NPS já
// montado para outro cliente (source_client_id) e provisiona uma cópia para
// este cliente ([id]), com slug próprio. Copia steps/theme/logic_rules/
// welcome_screen/endings/integrations do form original 1:1 — os ids das
// perguntas são reaproveitados como estão porque cada form tem seu próprio
// array JSONB de steps, então não há colisão entre forms diferentes.
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: targetClientId } = await context.params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sourceClientId = typeof body?.source_client_id === "string" ? body.source_client_id : null;
  if (!sourceClientId) {
    return NextResponse.json({ error: "source_client_id é obrigatório." }, { status: 400 });
  }
  if (sourceClientId === targetClientId) {
    return NextResponse.json({ error: "Escolha um cliente diferente para duplicar o formulário." }, { status: 400 });
  }

  const { data: targetClient, error: targetClientError } = await supabase
    .from("agency_clients")
    .select("id,name")
    .eq("id", targetClientId)
    .maybeSingle<ClientRow>();

  if (targetClientError) {
    return NextResponse.json({ error: targetClientError.message }, { status: 500 });
  }
  if (!targetClient) {
    return NextResponse.json({ error: "Cliente não encontrado ou sem permissão." }, { status: 404 });
  }

  const { data: sourceIntegration, error: sourceError } = await supabase
    .from("form_integrations")
    .select("settings,form_id")
    .eq("adapter", "nps")
    .eq("user_id", user.id)
    .contains("settings", { client_id: sourceClientId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<NpsIntegrationRow>();

  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 500 });
  }
  if (!sourceIntegration) {
    return NextResponse.json({ error: "O cliente de origem não tem um formulário de NPS para duplicar." }, { status: 404 });
  }

  const { data: sourceForm, error: sourceFormError } = await supabase
    .from("forms")
    .select("theme,settings,steps,logic_rules,welcome_screen,endings,integrations")
    .eq("id", sourceIntegration.form_id)
    .maybeSingle<Pick<Form, "theme" | "settings" | "steps" | "logic_rules" | "welcome_screen" | "endings" | "integrations">>();

  if (sourceFormError) {
    return NextResponse.json({ error: sourceFormError.message }, { status: 500 });
  }
  if (!sourceForm) {
    return NextResponse.json({ error: "Formulário de origem não encontrado." }, { status: 404 });
  }

  const rawSlug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const slug = rawSlug ? normalizeSlug(rawSlug) : generateNpsSlug(targetClient.name);

  if (!slug) {
    return NextResponse.json({ error: "Slug inválido." }, { status: 400 });
  }

  const { data: existingSlug } = await supabase
    .from("forms")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingSlug) {
    return NextResponse.json({ error: "Este slug já está em uso." }, { status: 409 });
  }

  const now = new Date().toISOString();

  const { data: newForm, error: formError } = await supabase
    .from("forms")
    .insert({
      user_id: user.id,
      created_by: user.id,
      updated_by: user.id,
      name: `NPS — ${targetClient.name}`,
      slug,
      description: `Formulário de NPS de ${targetClient.name}`,
      status: "published",
      published_at: now,
      theme: sourceForm.theme,
      settings: sourceForm.settings,
      steps: sourceForm.steps,
      logic_rules: sourceForm.logic_rules,
      welcome_screen: sourceForm.welcome_screen,
      endings: sourceForm.endings,
      integrations: sourceForm.integrations,
    })
    .select("id,slug")
    .single<{ id: string; slug: string }>();

  if (formError || !newForm) {
    return NextResponse.json({ error: formError?.message ?? "Erro ao duplicar formulário." }, { status: 500 });
  }

  const { error: integrationError } = await supabase
    .from("form_integrations")
    .insert({
      form_id: newForm.id,
      user_id: user.id,
      adapter: "nps",
      enabled: true,
      settings: {
        client_id: targetClient.id,
        client_name: targetClient.name,
        nps_step_id: sourceIntegration.settings.nps_step_id,
        notify_on_response: sourceIntegration.settings.notify_on_response,
      },
    });

  if (integrationError) {
    await supabase.from("forms").delete().eq("id", newForm.id);
    return NextResponse.json({ error: integrationError.message }, { status: 500 });
  }

  return NextResponse.json({ form: newForm }, { status: 201 });
}
