import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AvailabilityService } from "@/lib/appointments/availability-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url     = new URL(req.url);
  const dateStr = url.searchParams.get("date");

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: "Parâmetro 'date' obrigatório (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const svc    = new AvailabilityService(supabase);
  const result = await svc.getAvailableSlots(id, user.id, dateStr);

  if (!result.ok) {
    const status = result.errorCode === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ slots: result.data });
}
