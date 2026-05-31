export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { executeWorkflow, executeSingleResult } from "@/lib/workflow/executor";
import type { WorkflowJSON } from "@/lib/workflow/types";

// ── Resolve media node fileUrls para signed download URLs ─────────────────────
// A public_url do Supabase Storage só funciona em buckets públicos.
// Para buckets privados (padrão), é necessário usar signed download URLs
// com credenciais de servidor para o fetch funcionar no lado do servidor.

const STORAGE_BUCKET = "criativos";

// Extrai o storage path de uma URL pública do Supabase Storage
function extractStoragePath(publicUrl: string): string | null {
  // Formato: https://xxx.supabase.co/storage/v1/object/public/BUCKET/PATH
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx    = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

async function resolveMediaUrls(
  workflow: WorkflowJSON,
  supabase: SupabaseClient
): Promise<WorkflowJSON> {
  const resolvedNodes = await Promise.all(
    workflow.nodes.map(async (node) => {
      if (node.type !== "media") return node;

      const fileUrl = node.data.fileUrl as string | null | undefined;
      if (!fileUrl?.trim()) return node;

      // Tenta extrair o storage path para gerar signed download URL
      const storagePath = extractStoragePath(fileUrl);
      if (!storagePath) {
        // URL não é do Supabase Storage (ex: URL externa) — usa como está
        console.log("[MEDIA] URL externa mantida:", fileUrl.slice(0, 60));
        return node;
      }

      // Gera signed download URL válida por 5 minutos (suficiente para execução)
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 300);

      if (error || !data?.signedUrl) {
        console.warn("[MEDIA] Falha ao gerar signed URL para", storagePath, "—", error?.message ?? "sem dados");
        // Mantém a URL original; pode funcionar se o bucket for público
        return node;
      }

      console.log("[MEDIA] Signed download URL gerada para:", storagePath.slice(0, 60));
      return { ...node, data: { ...node.data, fileUrl: data.signedUrl } };
    })
  );

  return { ...workflow, nodes: resolvedNodes };
}

// POST /api/criativos/executar
// Executa o workflow do canvas em SSE — o cliente recebe eventos em tempo real
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401 });
  }

  let projeto_id: string;
  let result_node_id: string | null = null;
  try {
    const body     = await req.json();
    projeto_id     = body.projeto_id;
    result_node_id = body.result_node_id ?? null;
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

  // Substitui fileUrls dos Media Nodes por signed download URLs autenticadas
  // Isso garante que o fetch server-side funcione independentemente da visibilidade do bucket
  const workflow = await resolveMediaUrls(
    projeto.workflow_json as WorkflowJSON,
    supabase
  );

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
        if (result_node_id) {
          // Execução isolada — apenas o Result Node solicitado
          await executeSingleResult(workflow, result_node_id, apiKeys, send);
        } else {
          // Execução completa do workflow
          await executeWorkflow(workflow, apiKeys, send);
        }
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
