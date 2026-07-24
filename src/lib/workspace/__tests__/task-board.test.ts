import { describe, expect, it } from "vitest";
import {
  normalizeWorkspaceBoardColor,
  normalizeWorkspaceBoardName,
  selectWorkspaceTaskBoard,
} from "../task-board";
import type { WorkspaceTaskBoard } from "@/types/workspace";

function board(id: string, isDefault = false): WorkspaceTaskBoard {
  return {
    id,
    user_id: "owner",
    created_by: "owner",
    name: id,
    color: "#4a8fd4",
    is_default: isDefault,
    position: 0,
    created_at: "",
    updated_at: "",
  };
}

describe("workspace task boards", () => {
  it("prioriza o quadro solicitado e usa o padrão como fallback", () => {
    const boards = [board("geral", true), board("projeto")];
    expect(selectWorkspaceTaskBoard(boards, "projeto")?.id).toBe("projeto");
    expect(selectWorkspaceTaskBoard(boards, "inexistente")?.id).toBe("geral");
  });

  it("normaliza nome e limita a 80 caracteres", () => {
    expect(normalizeWorkspaceBoardName("  Projeto   Especial  ")).toBe("Projeto Especial");
    expect(normalizeWorkspaceBoardName("a".repeat(100))).toHaveLength(80);
  });

  it("aceita apenas cores hexadecimais completas", () => {
    expect(normalizeWorkspaceBoardColor("#ABCDEF")).toBe("#abcdef");
    expect(normalizeWorkspaceBoardColor("red")).toBe("#4a8fd4");
  });
});
