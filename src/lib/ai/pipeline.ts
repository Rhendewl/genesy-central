import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { generateCopy } from "./claude-client";
import { generateImage, generateCopyOpenAI } from "./openai-client";
import { generateCopyGemini } from "./gemini-client";
import { buildCopyPrompt, buildImagePrompt } from "./prompt-builder";
import type { CriativoProjeto, CriativoFormato } from "@/types";

const FORMATOS: CriativoFormato[] = ["1080x1080", "1080x1920", "1200x628", "1080x1080"];

interface AIConfig {
  anthropic_api_key: string | null;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  provider_copy: "anthropic" | "gemini" | "openai";
  provider_imagem: "openai" | "gemini";
}

// Busca a config de IA do usuário no banco.
// Fallback para env vars se o usuário não configurou.
async function getAIConfig(userId: string): Promise<AIConfig> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("criativo_configs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    anthropic_api_key: data?.anthropic_api_key ?? process.env.ANTHROPIC_API_KEY ?? null,
    openai_api_key:    data?.openai_api_key    ?? process.env.OPENAI_API_KEY    ?? null,
    gemini_api_key:    data?.gemini_api_key    ?? process.env.GEMINI_API_KEY    ?? null,
    provider_copy:     data?.provider_copy     ?? "anthropic",
    provider_imagem:   data?.provider_imagem   ?? "openai",
  };
}

async function updateJob(
  jobId: string,
  fields: { progresso?: number; status?: string; tokens_usados?: number; erro_mensagem?: string; iniciado_em?: string; concluido_em?: string }
) {
  const supabase = createAdminSupabaseClient();
  await supabase.from("criativo_jobs").update(fields).eq("id", jobId);
}

async function saveResultado(params: {
  jobId: string;
  projetoId: string;
  userId: string;
  variacao: number;
  headline: string;
  copy: string;
  cta: string;
  promptImagem: string;
  imagemUrl: string;
  formato: CriativoFormato;
  estiloAplicado: string;
}) {
  const supabase = createAdminSupabaseClient();
  await supabase.from("criativo_resultados").insert({
    job_id:          params.jobId,
    projeto_id:      params.projetoId,
    user_id:         params.userId,
    variacao:        params.variacao,
    headline:        params.headline,
    copy:            params.copy,
    cta:             params.cta,
    prompt_imagem:   params.promptImagem,
    imagem_url:      params.imagemUrl,
    formato:         params.formato,
    estilo_aplicado: params.estiloAplicado,
  });
}

// Gera copy usando o provider configurado pelo usuário
async function gerarCopy(
  prompt: string,
  config: AIConfig
): Promise<{ headline: string; copy: string; cta: string; tokensUsed: number }> {
  if (config.provider_copy === "gemini" && config.gemini_api_key) {
    return generateCopyGemini(prompt, config.gemini_api_key);
  }
  if (config.provider_copy === "openai" && config.openai_api_key) {
    return generateCopyOpenAI(prompt, config.openai_api_key);
  }
  if (config.anthropic_api_key) {
    return generateCopy(prompt, config.anthropic_api_key);
  }
  throw new Error("Nenhuma chave de API configurada para geração de texto. Configure em Criativos → Configurações.");
}

// Gera imagem usando o provider configurado pelo usuário
async function gerarImagem(
  prompt: string,
  config: AIConfig
): Promise<{ url: string; revisedPrompt: string }> {
  // Gemini Imagen ainda não tem API pública estável — usa OpenAI como fallback
  if (config.openai_api_key) {
    return generateImage(prompt, config.openai_api_key);
  }
  throw new Error("Nenhuma chave OpenAI configurada para geração de imagens. Configure em Criativos → Configurações.");
}

export async function runPipeline(
  jobId: string,
  projeto: CriativoProjeto,
  quantidade: number,
  userId: string
) {
  let totalTokens = 0;

  try {
    const config = await getAIConfig(userId);

    await updateJob(jobId, {
      status: "processando",
      iniciado_em: new Date().toISOString(),
      progresso: 0,
    });

    const tasks = Array.from({ length: quantidade }, (_, i) => i + 1);

    await Promise.allSettled(
      tasks.map(async (variacao) => {
        try {
          const copyPrompt = buildCopyPrompt({ projeto, variacao, totalVariacoes: quantidade });
          const copyResult = await gerarCopy(copyPrompt, config);
          totalTokens += copyResult.tokensUsed;

          const imagePrompt = buildImagePrompt(projeto, copyResult.headline, variacao);
          const imageResult = await gerarImagem(imagePrompt, config);

          const formato = FORMATOS[(variacao - 1) % FORMATOS.length];
          await saveResultado({
            jobId,
            projetoId:       projeto.id,
            userId,
            variacao,
            headline:        copyResult.headline,
            copy:            copyResult.copy,
            cta:             copyResult.cta,
            promptImagem:    imageResult.revisedPrompt,
            imagemUrl:       imageResult.url,
            formato,
            estiloAplicado:  projeto.estilo_visual,
          });

          const progresso = Math.round((variacao / quantidade) * 100);
          await updateJob(jobId, { progresso, tokens_usados: totalTokens });
        } catch (err) {
          console.error(`[pipeline] variação ${variacao} falhou:`, err);
        }
      })
    );

    await updateJob(jobId, {
      status: "concluido",
      progresso: 100,
      tokens_usados: totalTokens,
      concluido_em: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido no pipeline";
    console.error("[pipeline] erro geral:", err);
    await updateJob(jobId, {
      status: "erro",
      erro_mensagem: msg,
      concluido_em: new Date().toISOString(),
    });
  }
}
