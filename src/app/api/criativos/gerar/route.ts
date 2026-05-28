export const dynamic = "force-dynamic";
// maxDuration só é respeitado em planos Vercel Pro+
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { runPipeline } from "@/lib/ai/pipeline";
import type { CriativoProjeto } from "@/types";

// POST /api/criativos/gerar
// 1. Valida autenticação e projeto
// 2. Cria o job com status 'pendente'
// 3. Dispara o pipeline de forma assíncrona (fire & forget)
// 4. Retorna o jobId imediatamente para o frontend iniciar o realtime
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const body = await req.json();
    const { projeto_id, quantidade = 5 } = body;

    if (!projeto_id) {
      return NextResponse.json({ error: "projeto_id obrigatório." }, { status: 400 });
    }

    if (quantidade < 1 || quantidade > 20) {
      return NextResponse.json({ error: "Quantidade deve ser entre 1 e 20." }, { status: 400 });
    }

    // Busca o projeto e valida ownership
    const { data: projeto, error: projetoErr } = await supabase
      .from("criativo_projetos")
      .select("*")
      .eq("id", projeto_id)
      .eq("user_id", user.id)
      .single();

    if (projetoErr || !projeto) {
      return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    }

    // Verifica se já há um job em processamento para este projeto
    const { data: jobAtivo } = await supabase
      .from("criativo_jobs")
      .select("id")
      .eq("projeto_id", projeto_id)
      .eq("status", "processando")
      .maybeSingle();

    if (jobAtivo) {
      return NextResponse.json({ error: "Já existe uma geração em andamento para este projeto." }, { status: 409 });
    }

    // Cria o job com status inicial 'pendente'
    const admin = createAdminSupabaseClient();
    const { data: job, error: jobErr } = await admin
      .from("criativo_jobs")
      .insert({
        projeto_id,
        user_id: user.id,
        quantidade,
        status: "pendente",
        progresso: 0,
      })
      .select()
      .single();

    if (jobErr || !job) {
      console.error("[criativos/gerar] erro ao criar job:", jobErr);
      return NextResponse.json({ error: "Erro ao iniciar geração." }, { status: 500 });
    }

    // Dispara o pipeline de forma assíncrona — não aguarda conclusão
    // O frontend acompanha via Supabase Realtime no criativo_jobs
    runPipeline(job.id, projeto as CriativoProjeto, quantidade, user.id).catch(err => {
      console.error("[criativos/gerar] pipeline erro silencioso:", err);
    });

    // Retorna o jobId imediatamente
    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (err) {
    console.error("[criativos/gerar POST]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
