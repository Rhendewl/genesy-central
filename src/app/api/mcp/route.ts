import type { NextRequest } from "next/server";
import { chaveDoCabecalho } from "@/lib/mcp/auth";
import { metodoNaoPermitido, responderMcp } from "@/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return responderMcp(req, chaveDoCabecalho(req.headers.get("authorization")));
}
export const GET = metodoNaoPermitido;
export const DELETE = metodoNaoPermitido;
