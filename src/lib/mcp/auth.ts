import { secretMatches } from "@/lib/esteira/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Acesso ao conector MCP
//
//  - Alfred e Bruce (Claude Code no servidor): POST /api/mcp com
//    "Authorization: Bearer <GENESY_MCP_SECRET>".
//  - claude.ai (conector personalizado): o campo de URL não aceita cabeçalho,
//    então a mesma chave vai no caminho: /api/mcp/<GENESY_MCP_SECRET>.
//
// Tudo é gravado na conta do dono da agência (GENESY_MCP_OWNER_ID, ou
// ESTEIRA_OWNER_ID se a primeira não existir). Sem as variáveis, 503.
// ─────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type McpAuth = { ok: true; ownerId: string } | { ok: false; status: 401 | 503; error: string };

export function autenticarMcp(chaveRecebida: string | null | undefined): McpAuth {
  const segredo = process.env.GENESY_MCP_SECRET;
  const ownerId = process.env.GENESY_MCP_OWNER_ID || process.env.ESTEIRA_OWNER_ID;
  if (!segredo || segredo.length < 32 || !ownerId || !UUID.test(ownerId)) {
    return { ok: false, status: 503, error: "Conector MCP não configurado no servidor (GENESY_MCP_SECRET / GENESY_MCP_OWNER_ID)." };
  }
  if (!secretMatches(chaveRecebida, segredo)) return { ok: false, status: 401, error: "Não autorizado" };
  return { ok: true, ownerId };
}

export function chaveDoCabecalho(authorization: string | null): string | null {
  const m = authorization?.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
