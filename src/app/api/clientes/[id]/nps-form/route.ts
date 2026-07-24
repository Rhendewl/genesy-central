import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ensureClientFormFolder } from "@/lib/forms/form-folders";
import type { FormStep } from "@/types";

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
  id: string;
  enabled: boolean;
  settings: { client_id: string; nps_step_id: string; notify_on_response: boolean };
  forms: { id: string; slug: string; name: string; status: string; deleted_at: string | null } | null;
};

// GET /api/clientes/[id]/nps-form — retorna o formulário de NPS mais recente
// já provisionado para este cliente, se houver.
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: clientId } = await context.params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // forms!inner + is("forms.deleted_at", null): se o form foi excluído (ex: pela
  // aba normal de Formulários, sem perceber que estava vinculado ao NPS), a
  // integração órfã não deve aparecer como "existente" — o link "Editar
  // perguntas" apontaria pra um formulário que /api/formularios/:id já rejeita
  // (404 "Formulário não encontrado"), então aqui a busca precisa concordar.
  const { data, error } = await supabase
    .from("form_integrations")
    .select("id,enabled,settings,forms!inner(id,slug,name,status,deleted_at)")
    .eq("adapter", "nps")
    .eq("user_id", user.id)
    .contains("settings", { client_id: clientId })
    .is("forms.deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<NpsIntegrationRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || !data.forms) {
    return NextResponse.json({ npsForm: null });
  }

  return NextResponse.json({
    npsForm: {
      integrationId: data.id,
      formId: data.forms.id,
      slug: data.forms.slug,
      name: data.forms.name,
      status: data.forms.status,
      notifyOnResponse: data.settings.notify_on_response,
    },
  });
}

// PATCH /api/clientes/[id]/nps-form — liga/desliga a notificação de nova
// resposta para o formulário de NPS já existente deste cliente.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: clientId } = await context.params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.notify_on_response !== "boolean") {
    return NextResponse.json({ error: "notify_on_response é obrigatório." }, { status: 400 });
  }

  const { data: existing, error: findError } = await supabase
    .from("form_integrations")
    .select("id,settings")
    .eq("adapter", "nps")
    .eq("user_id", user.id)
    .contains("settings", { client_id: clientId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; settings: Record<string, unknown> }>();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Formulário de NPS não encontrado para este cliente." }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("form_integrations")
    .update({ settings: { ...existing.settings, notify_on_response: body.notify_on_response } })
    .eq("id", existing.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// POST /api/clientes/[id]/nps-form — provisiona um formulário de NPS pronto
// para este cliente: cria o form (já publicado) + a integração form_integrations
// (adapter "nps") que a rota pública de resposta usa para lançar a nota
// automaticamente em nps_records. Reaproveita 100% do editor/renderização
// pública já existentes do módulo Formulários — este endpoint só monta o
// ponto de partida.
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: clientId } = await context.params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: client, error: clientError } = await supabase
    .from("agency_clients")
    .select("id,name")
    .eq("id", clientId)
    .maybeSingle<ClientRow>();

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }

  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado ou sem permissão." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const notifyOnResponse = body?.notify_on_response !== false;

  const npsStepId = crypto.randomUUID();
  const steps: FormStep[] = [
    {
      id: npsStepId,
      type: "nps_scale",
      title: "De 0 a 10, o quanto você recomendaria a gente para um amigo ou colega?",
      required: true,
    },
    {
      id: crypto.randomUUID(),
      type: "long_text",
      title: "Quer nos contar mais sobre sua nota?",
      required: false,
    },
  ];

  const slug = generateNpsSlug(client.name);
  const now = new Date().toISOString();

  let folderId: string;
  try {
    folderId = await ensureClientFormFolder(supabase, user.id, client);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao preparar pasta do cliente." }, { status: 500 });
  }

  const { data: form, error: formError } = await supabase
    .from("forms")
    .insert({
      user_id: user.id,
      created_by: user.id,
      updated_by: user.id,
      name: `NPS — ${client.name}`,
      slug,
      description: `Formulário de NPS de ${client.name}`,
      origin: "nps",
      client_id: client.id,
      folder_id: folderId,
      status: "published",
      published_at: now,
      steps,
    })
    .select("id,slug")
    .single<{ id: string; slug: string }>();

  if (formError || !form) {
    return NextResponse.json({ error: formError?.message ?? "Erro ao criar formulário." }, { status: 500 });
  }

  const { error: integrationError } = await supabase
    .from("form_integrations")
    .insert({
      form_id: form.id,
      user_id: user.id,
      adapter: "nps",
      enabled: true,
      settings: {
        client_id: client.id,
        client_name: client.name,
        nps_step_id: npsStepId,
        notify_on_response: notifyOnResponse,
      },
    });

  if (integrationError) {
    // Reverte o form já criado — sem a integração, ele seria só um formulário
    // normal "órfão" que ninguém saberia que deveria virar NPS.
    await supabase.from("forms").delete().eq("id", form.id);
    return NextResponse.json({ error: integrationError.message }, { status: 500 });
  }

  return NextResponse.json({ form }, { status: 201 });
}
