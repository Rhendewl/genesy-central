import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AvailabilityService } from "@/lib/appointments/availability-service";

type Params = { params: Promise<{ id: string; exId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, exId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const svc    = new AvailabilityService(supabase);
  const result = await svc.deleteException(exId, id, user.id);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
