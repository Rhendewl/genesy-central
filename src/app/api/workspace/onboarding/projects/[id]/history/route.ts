// GET /api/workspace/onboarding/projects/[id]/history — timeline paginada (append-only)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OnboardingHistoryEntry } from "@/types/onboarding";

type Params = { params: Promise<{ id: string }> };

const PAGE_SIZE = 30;

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const page = Math.max(0, Number(new URL(req.url).searchParams.get("page") ?? "0"));

  try {
    const { data, error, count } = await supabase
      .from("onboarding_history")
      .select("*", { count: "exact" })
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const actorIds = Array.from(new Set((data ?? []).map((h) => h.actor_profile_id).filter((id): id is string => !!id)));
    const { data: profiles } = actorIds.length > 0
      ? await supabase.from("user_profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const entries: OnboardingHistoryEntry[] = (data ?? []).map((h) => ({
      ...h,
      actor_name: h.actor_profile_id ? nameById.get(h.actor_profile_id) ?? null : null,
    }));

    return NextResponse.json({ entries, total: count ?? entries.length, page, page_size: PAGE_SIZE });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
