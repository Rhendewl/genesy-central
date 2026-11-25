import type { NextRequest } from "next/server";
import { chaveDoCabecalho } from "@/lib/mcp/auth";
import { metodoNaoPermitido, responderMcp } from "@/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Mesma coisa que /api/mcp, com a chave no caminho (para o claude.ai).
export async function POST(req: NextRequest, { params }: { params: Promise<{ chave: string }> }) {
  const { chave } = await params;
  return responderMcp(req, chaveDoCabecalho(req.headers.get("authorization")) ?? decodeURIComponent(chave));
}
export const GET = metodoNaoPermitido;
export const DELETE = metodoNaoPermitido;
