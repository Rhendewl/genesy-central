import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { autenticarMcp } from "./auth";
import { FERRAMENTAS_GENESY } from "./ferramentas";
import { processarCorpo } from "./protocol";

const MAX_CORPO = 256 * 1024;

// Transporte Streamable HTTP sem sessão: só POST. GET (canal SSE) não é
// oferecido, o que a especificação permite com 405.
export async function responderMcp(req: NextRequest, chave: string | null) {
  const auth = autenticarMcp(chave);
  if (!auth.ok) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: auth.error } }, { status: auth.status });
  }
  const tamanho = Number(req.headers.get("content-length") ?? "0");
  if (tamanho > MAX_CORPO) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Requisição grande demais" } }, { status: 413 });
  }
  let corpo: unknown;
  try {
    const texto = await req.text();
    if (texto.length > MAX_CORPO) throw new Error("grande");
    corpo = JSON.parse(texto);
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } }, { status: 400 });
  }
  const { status, body } = await processarCorpo(corpo, FERRAMENTAS_GENESY, { ownerId: auth.ownerId });
  if (body === undefined) return new NextResponse(null, { status });
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function metodoNaoPermitido() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
