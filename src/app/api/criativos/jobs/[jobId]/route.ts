export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/criativos/jobs/[jobId]
export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { data, error } = await supabase
      .from("criativo_jobs")
      .select("*")
      .eq("id", params.jobId)
      .eq("user_id", user.id)
      .single();

    if (error) return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[criativos/jobs GET]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
