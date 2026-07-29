import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  buildDuplicateFormInsert,
  buildDuplicateIntegrationRows,
  copySlugCandidate,
  type DuplicableForm,
  type DuplicableIntegration,
} from "@/lib/forms/duplicate-form";

type Params = { params: Promise<{ id: string }> };

// POST /api/formularios/:id/duplicar
// Copies the complete form definition and its integrations. Visitor data,
// submissions, sessions, analytics, versions and delivery history are
// intentionally not copied.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: original, error: formError } = await supabase
    .from("forms")
    .select("name, slug, description, folder_id, theme, settings, steps, logic_rules, welcome_screen, endings, integrations, origin, client_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (formError || !original) {
    return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });
  }
  if (original.origin === "nps") {
    return NextResponse.json({ error: "Formulários NPS devem ser duplicados pelo módulo de Clientes" }, { status: 422 });
  }

  const admin = createAdminSupabaseClient();
  let slug = "";
  for (let attempt = 1; attempt <= 100; attempt++) {
    const candidate = copySlugCandidate(original.slug, attempt);
    const { data: collision } = await admin
      .from("forms")
      .select("id")
      .eq("slug", candidate)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (!collision) {
      slug = candidate;
      break;
    }
  }
  if (!slug) {
    return NextResponse.json({ error: "Não foi possível gerar um link único para a cópia" }, { status: 409 });
  }

  const { data: duplicate, error: duplicateError } = await supabase
    .from("forms")
    .insert(buildDuplicateFormInsert(original as DuplicableForm, { userId: user.id, slug }))
    .select("*")
    .single();

  if (duplicateError || !duplicate) {
    return NextResponse.json({ error: duplicateError?.message ?? "Erro ao duplicar formulário" }, { status: 500 });
  }

  const { data: integrations, error: integrationsReadError } = await supabase
    .from("form_integrations")
    .select("adapter, enabled, settings, secrets, event_filter, retry_policy, rate_limit")
    .eq("form_id", id)
    .eq("user_id", user.id);

  if (integrationsReadError) {
    await supabase.from("forms").delete().eq("id", duplicate.id).eq("user_id", user.id);
    return NextResponse.json({ error: "Erro ao copiar as integrações do formulário" }, { status: 500 });
  }

  if (integrations?.length) {
    const { error: integrationsWriteError } = await supabase
      .from("form_integrations")
      .insert(buildDuplicateIntegrationRows(
        integrations as DuplicableIntegration[],
        { formId: duplicate.id, userId: user.id },
      ));

    if (integrationsWriteError) {
      await supabase.from("forms").delete().eq("id", duplicate.id).eq("user_id", user.id);
      return NextResponse.json({ error: "Erro ao copiar as integrações do formulário" }, { status: 500 });
    }
  }

  return NextResponse.json({ formulario: duplicate }, { status: 201 });
}
