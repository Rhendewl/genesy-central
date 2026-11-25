import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { authenticateAgent } from "@/lib/esteira/auth";
import { parseEventoPayload } from "@/lib/esteira/payload";
import { registrarEvento } from "@/lib/esteira/service";

export const dynamic = "force-dynamic";

// POST /api/esteira/agente/eventos — uma linha no feed "Acontecendo agora".
export async function POST(req: NextRequest) {
  const auth = authenticateAgent(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = parseEventoPayload(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = await registrarEvento(createAdminSupabaseClient(), auth.ownerId, parsed.value);
  return result.ok
    ? NextResponse.json(result.body, { status: result.status })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
