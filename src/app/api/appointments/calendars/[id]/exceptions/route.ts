import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AvailabilityService } from "@/lib/appointments/availability-service";
import type { CreateAvailabilityExceptionPayload } from "@/types/appointments";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url      = new URL(req.url);
  const fromDate = url.searchParams.get("from") ?? undefined;
  const toDate   = url.searchParams.get("to")   ?? undefined;

  const svc    = new AvailabilityService(supabase);
  const result = await svc.getExceptions(id, user.id, fromDate, toDate);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ exceptions: result.data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as CreateAvailabilityExceptionPayload;

  const svc    = new AvailabilityService(supabase);
  const result = await svc.createException(id, user.id, body);

  if (!result.ok) {
    const status = result.errorCode === "NOT_FOUND"  ? 404
                 : result.errorCode === "VALIDATION" ? 400
                 : result.errorCode === "CONFLICT"   ? 409
                 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ exception: result.data }, { status: 201 });
}
