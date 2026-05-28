import type { WorkflowJSON, WorkflowNodeJSON } from "./types";
import { generateCopy } from "@/lib/ai/claude-client";
import { generateCopyOpenAI, generateImage } from "@/lib/ai/openai-client";
import { generateCopyGemini } from "@/lib/ai/gemini-client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiKeys {
  anthropic?: string | null;
  openai?: string | null;
  gemini?: string | null;
}

export type ExecutionEvent =
  | { type: "node_start";       nodeId: string }
  | { type: "node_complete";    nodeId: string; output: Record<string, unknown> }
  | { type: "node_error";       nodeId: string; error: string }
  | { type: "workflow_complete"; outputs: Record<string, Record<string, unknown>> }
  | { type: "workflow_error";   error: string };

export type ExecutionCallback = (event: ExecutionEvent) => void;

// ── Topological sort ──────────────────────────────────────────────────────────

function topologicalSort(
  nodes: WorkflowNodeJSON[],
  edges: Array<{ source: string; target: string }>
): WorkflowNodeJSON[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const nodeMap = new Map<string, WorkflowNodeJSON>();

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
    const id = queue.shift()!;
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

// ── AI prompt builder ─────────────────────────────────────────────────────────

function buildEnginePrompt(
  upstreamOutputs: Record<string, unknown>[],
  mode: string
): string {
  // Coleta todos os textos dos nodes de texto upstream
  const texts: string[] = [];
  const imageUrls: string[] = [];

  for (const out of upstreamOutputs) {
    if (out.node_type === "text" && out.content) {
      const label = (out.label as string) ?? "Instrução";
      texts.push(`[${label}]: ${out.content}`);
    }
    if (out.node_type === "media" && out.fileUrl) {
      imageUrls.push(out.fileUrl as string);
    }
  }

  const context = texts.join("\n");

  if (mode === "image") {
    return `Crie um criativo visual publicitário baseado neste briefing:

${context || "Criativo visual premium para redes sociais."}

${imageUrls.length > 0 ? `Referência visual: ${imageUrls[0]}` : ""}

Estilo: profissional, premium, impactante. Sem texto na imagem. Alta qualidade.`;
  }

  return `Você é um copywriter especialista em publicidade digital de alta performance.

BRIEFING:
${context || "Crie um copy persuasivo e profissional para uma campanha de marketing."}

Crie o copy para um criativo publicitário. Retorne EXATAMENTE este JSON (sem markdown):
{
  "headline": "Título principal impactante (máx 8 palavras)",
  "copy": "Texto persuasivo de apoio (máx 25 palavras)",
  "cta": "Chamada para ação (máx 4 palavras)"
}`;
}

// ── Node executor ─────────────────────────────────────────────────────────────

async function executeNode(
  node: WorkflowNodeJSON,
  upstreamOutputs: Record<string, unknown>[],
  apiKeys: ApiKeys
): Promise<Record<string, unknown>> {
  const d = node.data;

  switch (node.type) {
    // Text e Media são passthrough — apenas retornam seus dados para o Engine consumir
    case "text":
      return {
        node_type: "text",
        label: d.label ?? "Texto",
        content: d.content ?? "",
      };

    case "media":
      return {
        node_type: "media",
        label: d.label ?? "Imagem",
        mediaType: d.mediaType,
        fileUrl: d.fileUrl ?? null,
      };

    // Engine é o cérebro — agrega contexto e chama a IA
    case "engine": {
      const model = (d.provider as string) ?? "openai";
      const mode  = (d.mode    as string) ?? "image";

      if (mode === "copy" || mode === "both") {
        const prompt = buildEnginePrompt(upstreamOutputs, "copy");

        let headline = "";
        let copy = "";
        let cta = "";

        if (model === "anthropic") {
          if (!apiKeys.anthropic) throw new Error("Chave Anthropic não configurada.");
          const r = await generateCopy(prompt, apiKeys.anthropic);
          headline = r.headline; copy = r.copy; cta = r.cta;
        } else if (model === "openai") {
          if (!apiKeys.openai) throw new Error("Chave OpenAI não configurada.");
          const r = await generateCopyOpenAI(prompt, apiKeys.openai);
          headline = r.headline; copy = r.copy; cta = r.cta;
        } else if (model === "gemini") {
          if (!apiKeys.gemini) throw new Error("Chave Gemini não configurada.");
          const r = await generateCopyGemini(prompt, apiKeys.gemini);
          headline = r.headline; copy = r.copy; cta = r.cta;
        } else {
          throw new Error(`Modelo desconhecido: ${model}`);
        }

        const textOutput = `${headline}\n\n${copy}\n\n→ ${cta}`;

        if (mode === "copy") {
          return { node_type: "engine", generated_text: textOutput, headline, copy, cta };
        }

        // mode === "both": gera texto + imagem via DALL-E 3
        let imageUrl: string | null = null;
        if (apiKeys.openai) {
          const imgPromptBoth = buildEnginePrompt(upstreamOutputs, "image");
          const r = await generateImage(imgPromptBoth, apiKeys.openai);
          imageUrl = r.url;
        }

        return { node_type: "engine", generated_text: textOutput, generated_image_url: imageUrl, headline, copy, cta };
      }

      // mode === "image" — sempre usa DALL-E 3 (OpenAI)
      if (!apiKeys.openai) {
        throw new Error("Geração de imagens requer chave OpenAI (DALL-E 3). Configure em 'Configurar IAs'.");
      }
      const imgPrompt = buildEnginePrompt(upstreamOutputs, "image");
      const imgResult = await generateImage(imgPrompt, apiKeys.openai);
      return { node_type: "engine", generated_image_url: imgResult.url, revised_prompt: imgResult.revisedPrompt };
    }

    // Result apenas repassa o que recebeu do Engine
    case "result": {
      const engineOutput = upstreamOutputs.find(o => o.node_type === "engine");
      if (!engineOutput) return { node_type: "result" };
      return {
        node_type: "result",
        generated_text: engineOutput.generated_text ?? null,
        generated_image_url: engineOutput.generated_image_url ?? null,
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
  const edges = workflow.edges;
  const sorted = topologicalSort(workflow.nodes, edges);
  const outputs = new Map<string, Record<string, unknown>>();

  for (const node of sorted) {
    callback({ type: "node_start", nodeId: node.id });
    try {
      const upstream = getUpstreamOutputs(node.id, edges, outputs);
      const output = await executeNode(node, upstream, apiKeys);
      outputs.set(node.id, output);
      callback({ type: "node_complete", nodeId: node.id, output });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Erro desconhecido";
      callback({ type: "node_error", nodeId: node.id, error });
    }
  }

  const allOutputs: Record<string, Record<string, unknown>> = {};
  for (const [id, out] of Array.from(outputs)) allOutputs[id] = out;

  callback({ type: "workflow_complete", outputs: allOutputs });
}
