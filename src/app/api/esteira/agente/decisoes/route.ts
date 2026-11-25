import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { authenticateAgent } from "@/lib/esteira/auth";
import { parseAgente } from "@/lib/esteira/payload";

export const dynamic = "force-dynamic";

// POST /api/esteira/agente/decisoes {agente} — entrega (uma única vez) as aprovações e
// pedidos de ajuste feitos pela plataforma, e as propostas aceitas ou descartadas.
export async function POST(req: NextRequest) {
  const auth = authenticateAgent(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null) as { agente?: unknown } | null;
  const agente = parseAgente(body?.agente);
  if (!agente.ok) return NextResponse.json({ error: agente.error }, { status: 400 });
  const { data, error } = await createAdminSupabaseClient().rpc("esteira_claim_decisoes", { p_owner: auth.ownerId, p_agente: agente.value });
  if (error) return NextResponse.json({ error: "Não foi possível buscar as decisões." }, { status: 500 });
  return NextResponse.json(data ?? { itens: [], aprendizados: [] });
}
