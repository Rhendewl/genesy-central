import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { authenticateAgent } from "@/lib/esteira/auth";
import { parseItemPayload } from "@/lib/esteira/payload";
import { registrarItem } from "@/lib/esteira/service";

export const dynamic = "force-dynamic";

// POST /api/esteira/agente/itens — Alfred/Bruce criam ou atualizam um trabalho na esteira.
export async function POST(req: NextRequest) {
  const auth = authenticateAgent(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null);
  const parsed = parseItemPayload(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = await registrarItem(createAdminSupabaseClient(), auth.ownerId, parsed.value);
  return result.ok
    ? NextResponse.json(result.body, { status: result.status })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
