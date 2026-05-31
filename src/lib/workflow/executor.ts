import type { WorkflowJSON, WorkflowNodeJSON, AspectRatio } from "./types";
import { ASPECT_RATIO_FORMATS } from "./types";
import { generateCopy } from "@/lib/ai/claude-client";
import { generateCopyOpenAI, generateImage, generateImageWithReference } from "@/lib/ai/openai-client";
import { generateCopyGemini } from "@/lib/ai/gemini-client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiKeys {
  anthropic?: string | null;
  openai?: string | null;
  gemini?: string | null;
}

export type ExecutionEvent =
  | { type: "node_start";        nodeId: string }
  | { type: "node_complete";     nodeId: string; output: Record<string, unknown> }
  | { type: "node_error";        nodeId: string; error: string }
  | { type: "workflow_complete"; outputs: Record<string, Record<string, unknown>> }
  | { type: "workflow_error";    error: string };

export type ExecutionCallback = (event: ExecutionEvent) => void;

// ── Pre-flight validation ─────────────────────────────────────────────────────

interface ValidationResult {
  ok: boolean;
  error?: string;
}

function validateWorkflow(workflow: WorkflowJSON, apiKeys: ApiKeys): ValidationResult {
  const nodes = workflow.nodes;

  const engineNode = nodes.find(n => n.type === "engine");
  if (!engineNode) {
    return { ok: false, error: "[WORKFLOW] Nenhum Engine Node encontrado. Adicione um Engine Node ao canvas." };
  }

  const resultNodes = nodes.filter(n => n.type === "result");
  if (resultNodes.length === 0) {
    return { ok: false, error: "[WORKFLOW] Nenhum Result Node encontrado. Adicione um Result Node ao canvas." };
  }

  const textNodes = nodes.filter(n => n.type === "text");
  const hasTextContent = textNodes.some(n => {
    const content = n.data.content as string | undefined;
    return content && content.trim().length > 0;
  });
  if (textNodes.length > 0 && !hasTextContent) {
    return { ok: false, error: "[WORKFLOW] Text Node encontrado mas sem conteúdo. Preencha o prompt." };
  }

  const provider = engineNode.data.provider as string ?? "openai";
  const mode     = engineNode.data.mode     as string ?? "image";

  if ((mode === "image" || mode === "both") && !apiKeys.openai) {
    return { ok: false, error: "[WORKFLOW] Geração de imagens requer chave OpenAI. Configure em 'Configurar IAs'." };
  }
  if (mode === "copy" || mode === "both") {
    if (provider === "anthropic" && !apiKeys.anthropic) {
      return { ok: false, error: "[WORKFLOW] Provider 'Claude' selecionado mas chave Anthropic não configurada." };
    }
    if (provider === "openai" && !apiKeys.openai) {
      return { ok: false, error: "[WORKFLOW] Provider 'OpenAI' selecionado mas chave OpenAI não configurada." };
    }
    if (provider === "gemini" && !apiKeys.gemini) {
      return { ok: false, error: "[WORKFLOW] Provider 'Gemini' selecionado mas chave Gemini não configurada." };
    }
  }

  // Pelo menos um Result Node deve estar conectado ao Engine
  const hasEngineToResult = workflow.edges.some(e => {
    const target = workflow.nodes.find(n => n.id === e.target);
    return e.source === engineNode.id && target?.type === "result";
  });
  if (!hasEngineToResult) {
    return { ok: false, error: "[WORKFLOW] Engine Node não está conectado a nenhum Result Node. Conecte os nodes." };
  }

  return { ok: true };
}

// ── Topological sort ──────────────────────────────────────────────────────────

function topologicalSort(
  nodes: WorkflowNodeJSON[],
  edges: Array<{ source: string; target: string }>
): WorkflowNodeJSON[] {
  const inDegree = new Map<string, number>();
  const adj      = new Map<string, string[]>();
  const nodeMap  = new Map<string, WorkflowNodeJSON>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
    nodeMap.set(node.id, node);
  }

  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of Array.from(inDegree)) {
    if (deg === 0) queue.push(id);
  }

  const result: WorkflowNodeJSON[] = [];
  while (queue.length > 0) {
    const id   = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) result.push(node);
    for (const neighbor of adj.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Nodes isolados (sem conexões)
  for (const node of nodes) {
    if (!result.find(r => r.id === node.id)) result.push(node);
  }

  return result;
}

// ── Upstream context aggregator ───────────────────────────────────────────────

function getUpstreamOutputs(
  nodeId: string,
  edges: Array<{ source: string; target: string }>,
  outputs: Map<string, Record<string, unknown>>
): Record<string, unknown>[] {
  return edges
    .filter(e => e.target === nodeId)
    .map(e => outputs.get(e.source))
    .filter((o): o is Record<string, unknown> => !!o);
}

// ── Per-Result semantic context ───────────────────────────────────────────────

type MediaType = "logo" | "fachada" | "produto" | "fundo" | "pessoa";

interface MediaAsset {
  url: string;
  mediaType: MediaType;
}

interface ExecutionContext {
  resultNodeId: string;
  /** Text → Engine: direção criativa, estilo, regras, contexto global */
  creativeDirection: string[];
  /** Text → este Result: copy final visível no criativo deste output */
  adCopy: string[];
  /** Media → Engine: assets tipados de referência */
  mediaAssets: MediaAsset[];
  aspectRatio: AspectRatio;
  imageFormat: (typeof ASPECT_RATIO_FORMATS)[number];
}

function buildExecutionContext(
  resultNodeId: string,
  workflow: WorkflowJSON,
  engineNodeId: string
): ExecutionContext {
  const resultNode   = workflow.nodes.find(n => n.id === resultNodeId);
  const aspectRatio  = (resultNode?.data.aspectRatio as AspectRatio | undefined) ?? "1:1";
  const imageFormat  = ASPECT_RATIO_FORMATS.find(f => f.ratio === aspectRatio) ?? ASPECT_RATIO_FORMATS[0];

  const creativeDirection: string[]  = [];
  const adCopy: string[]             = [];
  const mediaAssets: MediaAsset[]    = [];

  for (const edge of workflow.edges) {
    const sourceNode = workflow.nodes.find(n => n.id === edge.source);
    if (!sourceNode) continue;

    if (sourceNode.type === "text") {
      const content = (sourceNode.data.content as string | undefined)?.trim();
      if (!content) continue;

      if (edge.target === engineNodeId) {
        // Text → Engine = direção criativa (compartilhada por todos os outputs)
        creativeDirection.push(content);
      } else if (edge.target === resultNodeId) {
        // Text → este Result = copy final específica deste output
        adCopy.push(content);
      }
    }

    if (sourceNode.type === "media" && edge.target === engineNodeId) {
      const fileUrl   = sourceNode.data.fileUrl   as string | null | undefined;
      const mediaType = (sourceNode.data.mediaType as MediaType | undefined) ?? "fachada";
      if (fileUrl) mediaAssets.push({ url: fileUrl, mediaType });
    }
  }

  console.log(
    `[CTX:${resultNodeId.slice(0, 8)}]`,
    `direção: ${creativeDirection.length} | copy: ${adCopy.length} | assets: ${mediaAssets.length} | ratio: ${aspectRatio}`
  );
  if (adCopy.length > 0) {
    console.log(`[CTX:${resultNodeId.slice(0, 8)}] Ad copy: "${adCopy[0].slice(0, 80)}"`);
  }

  return { resultNodeId, creativeDirection, adCopy, mediaAssets, aspectRatio, imageFormat };
}

// ── Semantic media instruction builder ───────────────────────────────────────

function buildMediaInstruction(assets: MediaAsset[]): string {
  if (assets.length === 0) return "";

  const parts: string[] = [];

  for (const asset of assets) {
    switch (asset.mediaType) {
      case "fachada":
        parts.push(
          "REFERÊNCIA VISUAL PRINCIPAL — FACHADA DO EMPREENDIMENTO:",
          "A imagem de referência contém o edifício/imóvel que está sendo anunciado.",
          "Preserve FIELMENTE:",
          "- Arquitetura e estrutura do edifício",
          "- Identidade e características únicas do imóvel",
          "- Proporções e composição arquitetônica",
          "NÃO substitua o edifício por outro. Construa o anúncio COM ESTE IMÓVEL como base.",
        );
        break;
      case "logo":
        parts.push(
          "REFERÊNCIA — LOGO/IDENTIDADE DE MARCA:",
          "Insira o logo da referência como elemento de branding no criativo.",
          "Posicione de forma elegante e profissional, respeitando safe areas e hierarquia visual.",
        );
        break;
      case "pessoa":
        parts.push(
          "REFERÊNCIA — PESSOA:",
          "Preserve a aparência e identidade visual da pessoa na referência.",
          "Mantenha fidelidade às características físicas. Contextualize em cenário adequado ao criativo.",
        );
        break;
      case "produto":
        parts.push(
          "REFERÊNCIA — PRODUTO:",
          "Preserve fielmente o produto da referência — forma, cor, detalhes e identidade.",
          "Construa composição premium que destaque o produto como protagonista do anúncio.",
        );
        break;
      case "fundo":
        parts.push(
          "REFERÊNCIA — AMBIENTE/BACKGROUND:",
          "Utilize o ambiente da referência como base da composição.",
          "Adapte com tratamento visual premium preservando a essência e identidade do local.",
        );
        break;
    }
  }

  return parts.join("\n");
}

// ── Prompt builder (por execution context) ────────────────────────────────────

function buildEnginePrompt(ctx: ExecutionContext, mode: string): string {
  const { creativeDirection, adCopy, mediaAssets, imageFormat } = ctx;

  const directionText   = creativeDirection.join("\n\n");
  const copyText        = adCopy.join("\n");
  const mediaInstruct   = buildMediaInstruction(mediaAssets);
  const hasRefImage     = mediaAssets.length > 0;

  console.log(
    `[ENGINE:${ctx.resultNodeId.slice(0, 8)}] mode: ${mode}`,
    `| direção: ${!!directionText} | copy: ${!!copyText} | assets: ${mediaAssets.length}`,
    hasRefImage ? `(${mediaAssets.map(a => a.mediaType).join(", ")})` : ""
  );

  if (mode === "image") {
    const parts: string[] = [];

    if (hasRefImage) {
      // Image-conditioned: instructs TRANSFORMATION of the reference
      parts.push(
        "Transforme a imagem de referência em um criativo publicitário premium.",
        "",
        mediaInstruct,
      );
    } else {
      parts.push(
        "Crie um criativo visual publicitário:",
        "",
        directionText || "Criativo visual premium para redes sociais.",
      );
    }

    if (directionText && hasRefImage) {
      parts.push("", "DIREÇÃO CRIATIVA:", directionText);
    }

    if (copyText) {
      parts.push(
        "",
        "COPY VISÍVEL NO CRIATIVO (elemento obrigatório de design):",
        `"${copyText}"`,
        "",
        "Inclua esta copy VISIVELMENTE na imagem com tipografia elegante, posicionamento estratégico, alta legibilidade, respeitando safe areas. A copy é prioridade máxima no design.",
      );
    }

    parts.push("", `Especificação de formato: ${imageFormat.promptHint}`);
    parts.push("", "Qualidade: profissional, premium, impactante.");

    return parts.join("\n").trim();
  }

  // copy / both mode
  return `Você é um copywriter especialista em publicidade digital de alta performance.

BRIEFING CRIATIVO:
${directionText || "Crie um copy persuasivo e profissional para uma campanha de marketing."}${
    mediaInstruct ? `\n\nCONTEXTO VISUAL (assets disponíveis):\n${mediaInstruct}` : ""
  }${
    copyText ? `\n\nCOPY FINAL DO CRIATIVO (use como base e refine):\n${copyText}` : ""
  }

Crie o copy para um criativo publicitário. Retorne EXATAMENTE este JSON (sem markdown):
{
  "headline": "Título principal impactante (máx 8 palavras)",
  "copy": "Texto persuasivo de apoio (máx 25 palavras)",
  "cta": "Chamada para ação (máx 4 palavras)"
}`;
}

// ── Image generation dispatcher (text-only vs reference-guided) ───────────────

async function generateImageForContext(
  ctx: ExecutionContext,
  prompt: string,
  apiKey: string
): Promise<{ url: string; revisedPrompt: string }> {
  const primaryAsset = ctx.mediaAssets[0];

  if (primaryAsset) {
    // Reference-guided: sem fallback silencioso — erro propaga para o usuário
    console.log(
      `[ENGINE:${ctx.resultNodeId.slice(0, 8)}] Geração image-conditioned`,
      `— tipo: ${primaryAsset.mediaType} — size: ${ctx.imageFormat.openaiSize}`
    );
    return await generateImageWithReference(
      primaryAsset.url,
      prompt,
      apiKey,
      ctx.imageFormat.openaiSize
    );
  }

  // Sem referência: text-to-image puro
  console.log(
    `[ENGINE:${ctx.resultNodeId.slice(0, 8)}] Geração text-to-image — size: ${ctx.imageFormat.openaiSize}`
  );
  return await generateImage(prompt, apiKey, ctx.imageFormat.openaiSize);
}

// ── Generate for one Result context ──────────────────────────────────────────

async function generateForContext(
  ctx: ExecutionContext,
  model: string,
  mode: string,
  apiKeys: ApiKeys
): Promise<Record<string, unknown>> {
  if (mode === "copy" || mode === "both") {
    const prompt = buildEnginePrompt(ctx, "copy");
    let headline = "", copy = "", cta = "";

    if (model === "anthropic") {
      if (!apiKeys.anthropic) throw new Error("Chave Anthropic não configurada. Acesse 'Configurar IAs'.");
      console.log(`[ENGINE:${ctx.resultNodeId.slice(0, 8)}] Gerando copy via Anthropic...`);
      const r = await generateCopy(prompt, apiKeys.anthropic);
      headline = r.headline; copy = r.copy; cta = r.cta;
    } else if (model === "openai") {
      if (!apiKeys.openai) throw new Error("Chave OpenAI não configurada. Acesse 'Configurar IAs'.");
      console.log(`[ENGINE:${ctx.resultNodeId.slice(0, 8)}] Gerando copy via OpenAI...`);
      const r = await generateCopyOpenAI(prompt, apiKeys.openai);
      headline = r.headline; copy = r.copy; cta = r.cta;
    } else if (model === "gemini") {
      if (!apiKeys.gemini) throw new Error("Chave Gemini não configurada. Acesse 'Configurar IAs'.");
      console.log(`[ENGINE:${ctx.resultNodeId.slice(0, 8)}] Gerando copy via Gemini...`);
      const r = await generateCopyGemini(prompt, apiKeys.gemini);
      headline = r.headline; copy = r.copy; cta = r.cta;
    } else {
      throw new Error(`Provider desconhecido: ${model}`);
    }

    console.log(`[ENGINE:${ctx.resultNodeId.slice(0, 8)}] Copy: "${headline.slice(0, 60)}"`);
    const textOutput = `${headline}\n\n${copy}\n\n→ ${cta}`;

    if (mode === "copy") {
      return { generated_text: textOutput, headline, copy, cta };
    }

    // both: copy + imagem
    if (!apiKeys.openai) {
      console.warn(`[ENGINE:${ctx.resultNodeId.slice(0, 8)}] mode=both sem chave OpenAI — pulando imagem.`);
      return { generated_text: textOutput, generated_image_url: null, headline, copy, cta };
    }
    const imgPromptBoth = buildEnginePrompt(ctx, "image");
    const imgResultBoth = await generateImageForContext(ctx, imgPromptBoth, apiKeys.openai);
    console.log(`[ENGINE:${ctx.resultNodeId.slice(0, 8)}] Imagem gerada (both).`);
    return { generated_text: textOutput, generated_image_url: imgResultBoth.url, headline, copy, cta };
  }

  // image only
  if (!apiKeys.openai) {
    throw new Error("Geração de imagens requer chave OpenAI (gpt-image-1). Configure em 'Configurar IAs'.");
  }
  const imgPrompt  = buildEnginePrompt(ctx, "image");
  const imgResult  = await generateImageForContext(ctx, imgPrompt, apiKeys.openai);
  console.log(`[ENGINE:${ctx.resultNodeId.slice(0, 8)}] Imagem gerada.`);
  return { generated_image_url: imgResult.url, revised_prompt: imgResult.revisedPrompt };
}

// ── Node executor ─────────────────────────────────────────────────────────────

async function executeNode(
  node: WorkflowNodeJSON,
  upstreamOutputs: Record<string, unknown>[],
  apiKeys: ApiKeys,
  workflow: WorkflowJSON,
  callback: ExecutionCallback
): Promise<Record<string, unknown>> {
  const d = node.data;

  switch (node.type) {
    case "text":
      console.log("[WORKFLOW] Text Node:", node.id.slice(0, 8), "| conteúdo:", String(d.content ?? "").slice(0, 80));
      return { node_type: "text", label: d.label ?? "Texto", content: d.content ?? "" };

    case "media":
      console.log("[WORKFLOW] Media Node:", node.id.slice(0, 8), "| fileUrl:", d.fileUrl ?? "(vazio)");
      return { node_type: "media", label: d.label ?? "Imagem", mediaType: d.mediaType, fileUrl: d.fileUrl ?? null };

    case "engine": {
      const model = (d.provider as string) ?? "openai";
      const mode  = (d.mode    as string) ?? "image";

      console.log("[ENGINE] Iniciando — provider:", model, "| mode:", mode);
      console.log("[ENGINE] API keys — openai:", !!apiKeys.openai, "| anthropic:", !!apiKeys.anthropic, "| gemini:", !!apiKeys.gemini);

      // Todos os Result Nodes conectados a este Engine
      const connectedResultIds = workflow.edges
        .filter(e => e.source === node.id)
        .map(e => e.target)
        .filter(id => workflow.nodes.find(n => n.id === id && n.type === "result"));

      console.log(`[ENGINE] ${connectedResultIds.length} Result Node(s) conectado(s) — executando isoladamente.`);

      const resultOutputs: Record<string, Record<string, unknown>> = {};

      for (const resultNodeId of connectedResultIds) {
        const ctx = buildExecutionContext(resultNodeId, workflow, node.id);

        // Sinaliza loading para este Result Node específico
        callback({ type: "node_start", nodeId: resultNodeId });

        try {
          const generated = await generateForContext(ctx, model, mode, apiKeys);
          resultOutputs[resultNodeId] = generated;

          // Entrega resultado diretamente ao Result Node
          callback({
            type: "node_complete",
            nodeId: resultNodeId,
            output: {
              node_type: "result",
              generated_text:      generated.generated_text      ?? null,
              generated_image_url: generated.generated_image_url ?? null,
            },
          });
        } catch (err) {
          const error = err instanceof Error ? err.message : "Erro desconhecido";
          console.error(`[ENGINE] Falha ao gerar Result ${resultNodeId.slice(0, 8)}:`, error);
          callback({ type: "node_error", nodeId: resultNodeId, error });
        }
      }

      // Retorna mapa de resultados para que Result Nodes propagam corretamente na sort
      return {
        node_type: "engine",
        results: resultOutputs,
        // Marcador para o loop principal ignorar eventos duplicados dos Result Nodes
        preEmittedResultIds: connectedResultIds,
      };
    }

    case "result": {
      // Busca o mapa de resultados no Engine upstream
      const engineOutput = upstreamOutputs.find(o => o.node_type === "engine");
      if (!engineOutput) {
        console.warn("[RESULT] Nenhum output de engine encontrado upstream.");
        return { node_type: "result" };
      }

      const results = engineOutput.results as Record<string, Record<string, unknown>> | undefined;
      const myResult = results?.[node.id];

      if (!myResult) {
        console.warn(`[RESULT:${node.id.slice(0, 8)}] Nenhum resultado específico encontrado no mapa do Engine.`);
        return { node_type: "result" };
      }

      console.log(
        `[RESULT:${node.id.slice(0, 8)}] Propagando — imagem: ${!!myResult.generated_image_url} | texto: ${!!myResult.generated_text}`
      );
      return {
        node_type: "result",
        generated_text:      myResult.generated_text      ?? null,
        generated_image_url: myResult.generated_image_url ?? null,
      };
    }

    default:
      return {};
  }
}

// ── Public: execute workflow ──────────────────────────────────────────────────

export async function executeWorkflow(
  workflow: WorkflowJSON,
  apiKeys: ApiKeys,
  callback: ExecutionCallback
): Promise<void> {
  console.log("[WORKFLOW] Iniciando — nodes:", workflow.nodes.length, "| edges:", workflow.edges.length);

  const validation = validateWorkflow(workflow, apiKeys);
  if (!validation.ok) {
    console.error("[WORKFLOW] Validação falhou:", validation.error);
    callback({ type: "workflow_error", error: validation.error! });
    return;
  }

  const edges  = workflow.edges;
  const sorted = topologicalSort(workflow.nodes, edges);
  const outputs = new Map<string, Record<string, unknown>>();

  // IDs de Result Nodes que o Engine já emitiu eventos — o loop principal os ignora
  const preEmittedResultIds = new Set<string>();

  console.log("[WORKFLOW] Ordem:", sorted.map(n => `${n.type}(${n.id.slice(0, 8)})`).join(" → "));

  for (const node of sorted) {
    // Result Nodes pré-emitidos pelo Engine só executam para propagar o output ao mapa —
    // sem emitir node_start/node_complete duplicados que causariam flash de loading.
    const isPreEmitted = preEmittedResultIds.has(node.id);

    if (!isPreEmitted) {
      callback({ type: "node_start", nodeId: node.id });
    }

    try {
      const upstream = getUpstreamOutputs(node.id, edges, outputs);
      const output   = await executeNode(node, upstream, apiKeys, workflow, callback);
      outputs.set(node.id, output);

      // Após Engine executar, registra quais Result Nodes foram pré-emitidos
      if (node.type === "engine" && Array.isArray(output.preEmittedResultIds)) {
        for (const rid of output.preEmittedResultIds as string[]) {
          preEmittedResultIds.add(rid);
        }
      }

      if (!isPreEmitted) {
        callback({ type: "node_complete", nodeId: node.id, output });
      }

      console.log(`[WORKFLOW] Concluído: ${node.type}(${node.id.slice(0, 8)})`);
    } catch (err) {
      const error = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(`[WORKFLOW] Erro: ${node.type}(${node.id.slice(0, 8)}):`, error);

      if (!isPreEmitted) {
        callback({ type: "node_error", nodeId: node.id, error });
      }

      if (node.type === "engine") {
        console.error("[WORKFLOW] Engine falhou — abortando workflow.");
        callback({ type: "workflow_error", error: `Falha no Engine: ${error}` });
        return;
      }
    }
  }

  const allOutputs: Record<string, Record<string, unknown>> = {};
  for (const [id, out] of Array.from(outputs)) allOutputs[id] = out;

  // Verifica se algum Result Node tem conteúdo real
  const resultNodes = workflow.nodes.filter(n => n.type === "result");
  const anyHasImage = resultNodes.some(n => !!(allOutputs[n.id]?.generated_image_url as string | undefined)?.trim());
  const anyHasText  = resultNodes.some(n => !!(allOutputs[n.id]?.generated_text  as string | undefined)?.trim());

  if (!anyHasImage && !anyHasText) {
    console.warn("[WORKFLOW] Nenhum Result Node com conteúdo — possível problema no pipeline.");
  } else {
    console.log(`[WORKFLOW] Sucesso — ${resultNodes.length} output(s) | imagem: ${anyHasImage} | texto: ${anyHasText}`);
  }

  callback({ type: "workflow_complete", outputs: allOutputs });
}

// ── Public: execute single Result Node in isolation ───────────────────────────

export async function executeSingleResult(
  workflow: WorkflowJSON,
  resultNodeId: string,
  apiKeys: ApiKeys,
  callback: ExecutionCallback
): Promise<void> {
  console.log("[SINGLE] Execução isolada — Result Node:", resultNodeId.slice(0, 8));

  const resultNode  = workflow.nodes.find(n => n.id === resultNodeId && n.type === "result");
  const engineNode  = workflow.nodes.find(n => n.type === "engine");

  if (!resultNode) {
    callback({ type: "workflow_error", error: "Result Node não encontrado no workflow." });
    return;
  }
  if (!engineNode) {
    callback({ type: "workflow_error", error: "Engine Node não encontrado no workflow." });
    return;
  }

  const isConnected = workflow.edges.some(
    e => e.source === engineNode.id && e.target === resultNodeId
  );
  if (!isConnected) {
    callback({ type: "workflow_error", error: "Este Result Node não está conectado ao Engine Node." });
    return;
  }

  const model = (engineNode.data.provider as string) ?? "openai";
  const mode  = (engineNode.data.mode    as string) ?? "image";

  if ((mode === "image" || mode === "both") && !apiKeys.openai) {
    callback({ type: "workflow_error", error: "Geração de imagens requer chave OpenAI. Configure em 'Configurar IAs'." });
    return;
  }
  if (mode === "copy" || mode === "both") {
    if (model === "anthropic" && !apiKeys.anthropic) {
      callback({ type: "workflow_error", error: "Chave Anthropic não configurada. Acesse 'Configurar IAs'." });
      return;
    }
    if (model === "openai" && !apiKeys.openai) {
      callback({ type: "workflow_error", error: "Chave OpenAI não configurada. Acesse 'Configurar IAs'." });
      return;
    }
    if (model === "gemini" && !apiKeys.gemini) {
      callback({ type: "workflow_error", error: "Chave Gemini não configurada. Acesse 'Configurar IAs'." });
      return;
    }
  }

  // Engine mostra que está ativo
  callback({ type: "node_start", nodeId: engineNode.id });
  // Result Node entra em loading
  callback({ type: "node_start", nodeId: resultNodeId });

  try {
    const ctx       = buildExecutionContext(resultNodeId, workflow, engineNode.id);
    const generated = await generateForContext(ctx, model, mode, apiKeys);

    const resultOutput = {
      node_type:           "result",
      generated_text:      generated.generated_text      ?? null,
      generated_image_url: generated.generated_image_url ?? null,
    };

    callback({ type: "node_complete", nodeId: engineNode.id,  output: { node_type: "engine" } });
    callback({ type: "node_complete", nodeId: resultNodeId,   output: resultOutput });
    callback({ type: "workflow_complete", outputs: { [resultNodeId]: resultOutput } });

    console.log("[SINGLE] Concluído — imagem:", !!generated.generated_image_url, "| texto:", !!generated.generated_text);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[SINGLE] Erro na geração isolada:", error);
    callback({ type: "node_error",      nodeId: resultNodeId, error });
    callback({ type: "workflow_error",  error: `Falha ao gerar: ${error}` });
  }
}
