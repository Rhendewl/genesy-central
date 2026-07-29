import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  hasWorkspaceTaskEditPermission,
  verifyWorkspaceTaskEditor,
} from "@/lib/workspace/task-authorization";

function supabaseFor(task: { created_by: string; user_id: string } | null, isAdmin: boolean) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: task, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue({ data: isAdmin, error: null });

  return {
    client: { from, rpc } as unknown as SupabaseClient,
    rpc,
  };
}

describe("workspace task edit permission", () => {
  const task = {
    created_by: "creator-user",
    user_id: "workspace-owner",
  };

  it("permite ao criador editar a própria tarefa", () => {
    expect(hasWorkspaceTaskEditPermission(task, "creator-user", false)).toBe(true);
  });

  it("permite a um administrador editar tarefa criada por terceiro", () => {
    expect(hasWorkspaceTaskEditPermission(task, "admin-user", true)).toBe(true);
  });

  it("bloqueia membro comum em tarefa criada por terceiro", () => {
    expect(hasWorkspaceTaskEditPermission(task, "member-user", false)).toBe(false);
  });

  it("autoriza administrador no verificador usado pelas APIs", async () => {
    const { client, rpc } = supabaseFor(task, true);

    await expect(verifyWorkspaceTaskEditor(client, "task-1", "admin-user"))
      .resolves.toEqual({ allowed: true });
    expect(rpc).toHaveBeenCalledWith("is_admin_of_user", {
      target_user_id: "workspace-owner",
    });
  });

  it("retorna 403 para membro comum no verificador usado pelas APIs", async () => {
    const { client } = supabaseFor(task, false);

    await expect(verifyWorkspaceTaskEditor(client, "task-1", "member-user"))
      .resolves.toEqual({
        allowed: false,
        status: 403,
        error: "Somente o criador ou um administrador pode alterar esta tarefa",
      });
  });
});
