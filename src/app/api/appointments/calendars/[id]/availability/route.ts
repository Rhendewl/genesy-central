import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AvailabilityService } from "@/lib/appointments/availability-service";
import type { UpsertAvailabilityRulesPayload } from "@/types/appointments";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const svc    = new AvailabilityService(supabase);
  const result = await svc.getRules(id, user.id);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ rules: result.data });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as UpsertAvailabilityRulesPayload;

  if (!Array.isArray(body?.rules)) {
    return NextResponse.json({ error: "Campo 'rules' deve ser um array" }, { status: 400 });
  }

  const svc    = new AvailabilityService(supabase);
  const result = await svc.upsertRules(id, user.id, body.rules);

  if (!result.ok) {
    const status = result.errorCode === "NOT_FOUND" ? 404 : result.errorCode === "VALIDATION" ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ rules: result.data });
}
