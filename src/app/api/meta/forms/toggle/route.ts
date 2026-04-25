// POST /api/meta/forms/toggle
// Enable or disable lead capture for a specific form.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { pageId, formId, formName, active } = await req.json() as {
    pageId:   string;
    formId:   string;
    formName: string;
    active:   boolean;
  };

  if (!pageId || !formId) {
    return NextResponse.json({ error: "pageId e formId são obrigatórios" }, { status: 400 });
  }

  // UPSERT: insere ou atualiza baseado no conflito (user_id, form_id)
  const { error } = await supabase
    .from("meta_form_subscriptions")
    .upsert(
      {
        user_id:    user.id,
        page_id:    pageId,
        form_id:    formId,
        form_name:  formName,
        is_active:  active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,form_id" }
    );

  if (error) {
    console.error("[forms/toggle] DB error:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
