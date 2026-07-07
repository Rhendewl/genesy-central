import { NextRequest, NextResponse }  from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { BookingService }             from "@/lib/appointments/booking-service";

// POST /api/appointments/bookings/bulk-delete
// Exclusão permanente de vários agendamentos de uma vez — mesma regra do
// DELETE individual (limpeza best-effort do evento no Google Calendar antes
// de apagar), reaproveitando BookingService.deleteBooking pra cada id.
// Roda sequencialmente; a falha de um item não impede os demais.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { ids?: string[] } | null;
  const ids = body?.ids;

  if (!ids?.length) {
    return NextResponse.json({ error: "Nenhum agendamento selecionado" }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: "Selecione no máximo 200 agendamentos por vez" }, { status: 400 });
  }

  const service = new BookingService(supabase);
  const deleted: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of ids) {
    const result = await service.deleteBooking(id, user.id);
    if (result.ok) deleted.push(id);
    else failed.push({ id, error: result.error ?? "Erro desconhecido" });
  }

  return NextResponse.json({ deleted, failed });
}
