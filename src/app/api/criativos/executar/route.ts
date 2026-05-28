export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { executeWorkflow } from "@/lib/workflow/executor";
import type { WorkflowJSON } from "@/lib/workflow/types";

// POST /api/criativos/executar
// Executa o workflow do canvas em SSE — o cliente recebe eventos em tempo real
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401 });
  }

  let projeto_id: string;
  try {
    const body = await req.json();
    projeto_id = body.projeto_id;
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido." }), { status: 400 });
  }

  if (!projeto_id) {
    return new Response(JSON.stringify({ error: "projeto_id obrigatório." }), { status: 400 });
  }

  // Carrega o projeto + workflow_json
  const { data: projeto } = await supabase
    .from("criativo_projetos")
    .select("id, nome, workflow_json")
    .eq("id", projeto_id)
    .eq("user_id", user.id)
    .single();

  if (!projeto) {
    return new Response(JSON.stringify({ error: "Projeto não encontrado." }), { status: 404 });
  }

  if (!projeto.workflow_json) {
    return new Response(JSON.stringify({ error: "O projeto não tem workflow. Salve o canvas primeiro." }), { status: 400 });
  }

  // Carrega as chaves de IA do usuário
  const { data: config } = await supabase
    .from("criativo_configs")
    .select("anthropic_api_key, openai_api_key, gemini_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  const apiKeys = {
    anthropic: config?.anthropic_api_key ?? null,
    openai:    config?.openai_api_key    ?? null,
    gemini:    config?.gemini_api_key    ?? null,
  };

  // SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream já fechada
        }
      };

      try {
        await executeWorkflow(
          projeto.workflow_json as WorkflowJSON,
          apiKeys,
          send
        );
      } catch (err) {
        send({
          type: "workflow_error",
          error: err instanceof Error ? err.message : "Erro ao executar workflow",
        });
      } finally {
        try { controller.close(); } catch { /* ignorar */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
