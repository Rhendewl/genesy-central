import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { authenticateAgent } from "@/lib/esteira/auth";
import { parseAprendizadoPayload } from "@/lib/esteira/payload";
import { registrarAprendizado } from "@/lib/esteira/service";

export const dynamic = "force-dynamic";

// POST /api/esteira/agente/aprendizados — regra salva (tipo "regra") ou proposta para aprovar (tipo "proposta").
export async function POST(req: NextRequest) {
  const auth = authenticateAgent(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = parseAprendizadoPayload(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = await registrarAprendizado(createAdminSupabaseClient(), auth.ownerId, parsed.value);
  return result.ok
    ? NextResponse.json(result.body, { status: result.status })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
