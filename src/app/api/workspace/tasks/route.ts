// GET  /api/workspace/tasks — lista tarefas (filtros opcionais)
// POST /api/workspace/tasks — cria tarefa (entra em "a_fazer" por padrão)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getPlatformEventBus } from "@/lib/event-bus/platform";
import type { NewWorkspaceTask, WorkspaceTask } from "@/types/workspace";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url         = new URL(req.url);
  const status      = url.searchParams.get("status")      ?? undefined;
  const assigneeId  = url.searchParams.get("assignee_id")  ?? undefined;
  const dueBefore   = url.searchParams.get("due_before")   ?? undefined;
  const dueAfter    = url.searchParams.get("due_after")    ?? undefined;
  const search      = url.searchParams.get("search")       ?? undefined;
  const boardId     = url.searchParams.get("board_id")     ?? undefined;
  // De quem é este Workspace — o próprio usuário por padrão, ou (se a RLS
  // permitir, isto é, se quem pede for admin da mesma organização) um colega
  // sendo visualizado via Painel Equipe. Nunca deixamos a query sem esse
  // filtro: sem ele, um admin (com acesso amplo via is_admin_of_user na RLS)
  // veria as tarefas de toda a equipe misturadas no próprio "Meu Workspace".
  const targetUserId = url.searchParams.get("as_user_id") || user.id;

  try {
    // Tarefas que targetUserId criou OU das quais é responsável — mesma
    // regra da RLS pessoal (Fase 1), só que calculada "de fora" para X.
    const { data: targetProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("auth_user_id", targetUserId)
      .maybeSingle();

    let assignedTaskIds: string[] = [];
    if (targetProfile?.id) {
      const { data: rows } = await supabase
        .from("workspace_task_assignees")
        .select("task_id")
        .eq("assignee_id", targetProfile.id);
      assignedTaskIds = (rows ?? []).map((r) => r.task_id);
    }

    let query = supabase.from("workspace_tasks").select("*").order("position", { ascending: true });
    query = assignedTaskIds.length > 0
      ? query.or(`user_id.eq.${targetUserId},id.in.(${assignedTaskIds.join(",")})`)
      : query.eq("user_id", targetUserId);

    if (status)    query = query.eq("status", status);
    if (dueBefore) query = query.lte("due_date", dueBefore);
    if (dueAfter)  query = query.gte("due_date", dueAfter);
    if (search)    query = query.ilike("title", `%${search}%`);
    if (boardId)   query = query.eq("board_id", boardId);

    if (assigneeId) {
      const { data: rows } = await supabase
        .from("workspace_task_assignees")
        .select("task_id")
        .eq("assignee_id", assigneeId);
      const taskIds = (rows ?? []).map((r) => r.task_id);
      query = query.in("id", taskIds.length > 0 ? taskIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const taskIds = (data ?? []).map((t) => t.id);
    const { data: allAssignees } = taskIds.length > 0
      ? await supabase.from("workspace_task_assignees").select("task_id,assignee_id").in("task_id", taskIds)
      : { data: [] as { task_id: string; assignee_id: string }[] };

    const assigneesByTask = new Map<string, string[]>();
    for (const row of allAssignees ?? []) {
      const cur = assigneesByTask.get(row.task_id) ?? [];
      cur.push(row.assignee_id);
      assigneesByTask.set(row.task_id, cur);
    }

    const tasks = ((data ?? []) as WorkspaceTask[]).map((t) => ({
      ...t,
      assignee_ids: assigneesByTask.get(t.id) ?? [],
      can_edit: t.created_by === user.id,
    }));

    return NextResponse.json({ tasks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as (NewWorkspaceTask & { user_id?: string }) | null;
  if (!body?.title) {
    return NextResponse.json({ error: "title é obrigatório" }, { status: 400 });
  }

  try {
    const status = body.status ?? "a_fazer";

    // Escopado por user_id (o dono real da coluna, não quem está logado) —
    // sem isso, a visão ampliada de um admin (is_admin_of_user na RLS)
    // misturaria a posição de tarefas de outras pessoas neste cálculo.
    let maxPositionQuery = supabase
      .from("workspace_tasks")
      .select("position")
      .eq("status", status)
      .eq("user_id", body.user_id ?? user.id);
    if (body.board_id) maxPositionQuery = maxPositionQuery.eq("board_id", body.board_id);
    const { data: maxRow } = await maxPositionQuery
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (maxRow?.position ?? -10) + 10;

    const { data, error } = await supabase
      .from("workspace_tasks")
      .insert({
        // user_id só é enviado quando o admin cria "em nome de" um colega
        // (Painel Equipe) — a RLS (is_admin_of_user) valida se é permitido;
        // sem isso, o trigger auto_set_own_id preenche com o próprio uid.
        ...(body.user_id ? { user_id: body.user_id } : {}),
        created_by:  user.id,
        ...(body.board_id ? { board_id: body.board_id } : {}),
        title:       body.title,
        description: body.description ?? null,
        status,
        priority:    body.priority ?? "media",
        tags:        body.tags ?? [],
        due_date:    body.due_date ?? null,
        due_time:    body.due_time ?? null,
        color:       body.color ?? null,
        notes:       body.notes ?? null,
        position,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    const assigneeIds = body.assignee_ids ?? [];
    if (assigneeIds.length > 0) {
      const { error: assigneesError } = await supabase
        .from("workspace_task_assignees")
        .insert(assigneeIds.map((assignee_id) => ({ task_id: data.id, assignee_id })));
      if (assigneesError) throw new Error(assigneesError.message);

      await getPlatformEventBus().publish("task.assigned", {
        taskId:      data.id,
        boardId:     data.board_id,
        taskTitle:   data.title,
        assigneeIds,
        actorUserId: user.id,
        priority:    data.priority,
        dueDate:     data.due_date,
      });
    }

    return NextResponse.json({
      task: { ...data, assignee_ids: assigneeIds, can_edit: data.created_by === user.id } as WorkspaceTask,
    }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
