import { describe, expect, it } from "vitest";
import { ErroFerramenta, processarCorpo, processarMensagem, type McpFerramenta } from "../protocol";

const ctx = { ownerId: "00000000-0000-0000-0000-000000000001" };
const eco: McpFerramenta = {
  name: "eco", title: "Eco", description: "Devolve o que recebe", readOnly: true,
  inputSchema: { type: "object", properties: { x: { type: "string" } } },
  handler: async (args, c) => ({ recebido: args.x, dono: c.ownerId }),
};
const falha: McpFerramenta = {
  name: "falha", title: "Falha", description: "", inputSchema: { type: "object" },
  handler: async () => { throw new ErroFerramenta("Cliente não encontrado."); },
};
const quebra: McpFerramenta = {
  name: "quebra", title: "Quebra", description: "", inputSchema: { type: "object" },
  handler: async () => { throw new Error("senha do banco vazou aqui"); },
};
const ferramentas = [eco, falha, quebra];

describe("protocolo MCP", () => {
  it("initialize devolve a versão pedida quando suportada", async () => {
    const r = await processarMensagem({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, ferramentas, ctx);
    expect(r?.result).toMatchObject({ protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "genesy" } });
  });
  it("initialize cai na versão mais nova quando a pedida é desconhecida", async () => {
    const r = await processarMensagem({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } }, ferramentas, ctx);
    expect((r?.result as { protocolVersion: string }).protocolVersion).toBe("2025-06-18");
  });
  it("notificação não tem resposta (202)", async () => {
    expect(await processarCorpo({ jsonrpc: "2.0", method: "notifications/initialized" }, ferramentas, ctx)).toEqual({ status: 202 });
  });
  it("tools/list mostra as ferramentas com a dica de só leitura", async () => {
    const r = await processarMensagem({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ferramentas, ctx);
    const tools = (r?.result as { tools: { name: string; annotations: { readOnlyHint: boolean } }[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(["eco", "falha", "quebra"]);
    expect(tools[0].annotations.readOnlyHint).toBe(true);
    expect(tools[1].annotations.readOnlyHint).toBe(false);
  });
  it("tools/call executa com a conta do dono", async () => {
    const r = await processarMensagem({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "eco", arguments: { x: "oi" } } }, ferramentas, ctx);
    expect(r?.result).toMatchObject({ isError: false, structuredContent: { recebido: "oi", dono: ctx.ownerId } });
  });
  it("erro de uso volta para o modelo com isError", async () => {
    const r = await processarMensagem({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "falha" } }, ferramentas, ctx);
    expect(r?.result).toMatchObject({ isError: true, content: [{ type: "text", text: "Cliente não encontrado." }] });
  });
  it("erro interno não vaza detalhes", async () => {
    const r = await processarMensagem({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "quebra" } }, ferramentas, ctx);
    const texto = (r?.result as { content: { text: string }[] }).content[0].text;
    expect(texto).not.toContain("senha");
  });
  it("ferramenta desconhecida e método desconhecido viram erro JSON-RPC", async () => {
    const a = await processarMensagem({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "nada" } }, ferramentas, ctx);
    const b = await processarMensagem({ jsonrpc: "2.0", id: 7, method: "sampling/xyz" }, ferramentas, ctx);
    expect(a?.error?.code).toBe(-32602);
    expect(b?.error?.code).toBe(-32601);
  });
  it("mensagem inválida e lote", async () => {
    expect((await processarMensagem({ id: 1 }, ferramentas, ctx))?.error?.code).toBe(-32600);
    const lote = await processarCorpo([
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
    ], ferramentas, ctx);
    expect(lote.status).toBe(200);
    expect(lote.body).toHaveLength(1);
  });
});
