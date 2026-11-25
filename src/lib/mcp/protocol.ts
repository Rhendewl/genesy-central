// Núcleo do servidor MCP da Genesy (Model Context Protocol, transporte
// "Streamable HTTP" sem sessão): recebe JSON-RPC 2.0 por POST e responde em JSON.
// Puro e sem dependências, para ser testado sem banco.

export const MCP_VERSOES = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const MCP_SERVIDOR = { name: "genesy", title: "Genesy · plataforma da agência", version: "1.0.0" };

export const MCP_INSTRUCOES = [
  "Ferramentas da plataforma Genesy (agência de marketing imobiliário).",
  "Use listar_clientes para achar o cliente_id antes de salvar ou buscar criativos.",
  "salvar_criativo guarda a imagem ou o vídeo na biblioteca do cliente e devolve uma URL pública, pronta para Meta Ads e Instagram.",
  "criar_tarefa cria uma tarefa no Workspace do dono da agência.",
  "esteira_registrar mostra o andamento de um trabalho na Esteira das IAs.",
  "Financeiro: listar_financeiro mostra o mês; registrar_receita, registrar_despesa e marcar_receita_paga lançam na plataforma — só quando o dono pedir, confirmando valor, data e cliente antes.",
].join(" ");

export type JsonSchema = Record<string, unknown>;

export interface McpContexto { ownerId: string }

export interface McpFerramenta {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** true = só lê dados (dica para o cliente MCP). */
  readOnly?: boolean;
  handler: (args: Record<string, unknown>, ctx: McpContexto) => Promise<unknown>;
}

/** Erro de uso de ferramenta: vira resposta com isError, que o modelo lê e corrige. */
export class ErroFerramenta extends Error {}

type Id = string | number | null;
interface Requisicao { jsonrpc: "2.0"; id?: Id; method: string; params?: Record<string, unknown> }
export interface Resposta { jsonrpc: "2.0"; id: Id; result?: unknown; error?: { code: number; message: string } }

const erro = (id: Id, code: number, message: string): Resposta => ({ jsonrpc: "2.0", id, error: { code, message } });
const ok = (id: Id, result: unknown): Resposta => ({ jsonrpc: "2.0", id, result });

function ehRequisicao(v: unknown): v is Requisicao {
  return typeof v === "object" && v !== null && (v as { jsonrpc?: unknown }).jsonrpc === "2.0"
    && typeof (v as { method?: unknown }).method === "string";
}

function textoDoResultado(valor: unknown): string {
  return typeof valor === "string" ? valor : JSON.stringify(valor, null, 2);
}

/** Processa UMA mensagem. Notificações (sem id) não têm resposta: devolve null. */
export async function processarMensagem(msg: unknown, ferramentas: McpFerramenta[], ctx: McpContexto): Promise<Resposta | null> {
  if (!ehRequisicao(msg)) {
    const id = (typeof msg === "object" && msg && "id" in msg ? (msg as { id: Id }).id : null) ?? null;
    return erro(id, -32600, "Requisição JSON-RPC inválida");
  }
  const notificacao = msg.id === undefined;
  if (notificacao) return null;
  const id = msg.id as Id;
  const params = msg.params ?? {};

  switch (msg.method) {
    case "initialize": {
      const pedida = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const versao = (MCP_VERSOES as readonly string[]).includes(pedida) ? pedida : MCP_VERSOES[0];
      return ok(id, {
        protocolVersion: versao,
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVIDOR,
        instructions: MCP_INSTRUCOES,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
        tools: ferramentas.map((f) => ({
          name: f.name,
          title: f.title,
          description: f.description,
          inputSchema: f.inputSchema,
          annotations: { title: f.title, readOnlyHint: f.readOnly === true },
        })),
      });
    case "tools/call": {
      const nome = typeof params.name === "string" ? params.name : "";
      const ferramenta = ferramentas.find((f) => f.name === nome);
      if (!ferramenta) return erro(id, -32602, `Ferramenta desconhecida: ${nome || "(sem nome)"}`);
      const args = typeof params.arguments === "object" && params.arguments !== null && !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>) : {};
      try {
        const resultado = await ferramenta.handler(args, ctx);
        const estruturado = typeof resultado === "object" && resultado !== null && !Array.isArray(resultado) ? resultado : undefined;
        return ok(id, {
          content: [{ type: "text", text: textoDoResultado(resultado) }],
          ...(estruturado ? { structuredContent: estruturado } : {}),
          isError: false,
        });
      } catch (e) {
        const mensagem = e instanceof ErroFerramenta ? e.message : "Falha interna ao executar a ferramenta. Tente de novo em instantes.";
        if (!(e instanceof ErroFerramenta)) console.error(`[mcp] ${nome}:`, e instanceof Error ? e.message : e);
        return ok(id, { content: [{ type: "text", text: mensagem }], isError: true });
      }
    }
    case "resources/list":
      return ok(id, { resources: [] });
    case "prompts/list":
      return ok(id, { prompts: [] });
    default:
      return erro(id, -32601, `Método não suportado: ${msg.method}`);
  }
}

/** Corpo do POST: uma mensagem ou um lote. Só notificações → 202 sem corpo. */
export async function processarCorpo(corpo: unknown, ferramentas: McpFerramenta[], ctx: McpContexto): Promise<{ status: number; body?: unknown }> {
  if (Array.isArray(corpo)) {
    if (corpo.length === 0) return { status: 400, body: erro(null, -32600, "Lote vazio") };
    const respostas = (await Promise.all(corpo.map((m) => processarMensagem(m, ferramentas, ctx)))).filter((r): r is Resposta => r !== null);
    return respostas.length ? { status: 200, body: respostas } : { status: 202 };
  }
  const resposta = await processarMensagem(corpo, ferramentas, ctx);
  return resposta ? { status: 200, body: resposta } : { status: 202 };
}
