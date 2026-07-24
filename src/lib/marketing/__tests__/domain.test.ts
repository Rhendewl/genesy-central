import { describe, expect, it } from "vitest";
import { marketingStats, parseMarketingContentInput, parseMarketingIdeaInput } from "@/lib/marketing/domain";
import type { MarketingContent } from "@/types/marketing";

describe("marketing domain validation", () => {
  it("normaliza um conteúdo mínimo sem acoplar ao Instagram", () => {
    expect(parseMarketingContentInput({ title: "  Lançamento  ", platform: "linkedin", format: "article" })).toMatchObject({
      title: "Lançamento", platform: "linkedin", format: "article", status: "planned",
    });
  });

  it("rejeita conteúdo e ideia sem título", () => {
    expect(() => parseMarketingContentInput({ title: " " })).toThrow("Título é obrigatório");
    expect(() => parseMarketingIdeaInput({ description: "sem título" })).toThrow("Título é obrigatório");
  });

  it("descarta links não seguros", () => {
    expect(parseMarketingIdeaInput({ title: "Ideia", reference_links: ["javascript:alert(1)", "https://genesy.test/ref"] }).reference_links)
      .toEqual(["https://genesy.test/ref"]);
  });

  it("aceita apenas identificadores válidos ao vincular uma tarefa do Workspace", () => {
    const taskId = "123e4567-e89b-12d3-a456-426614174000";
    expect(parseMarketingContentInput({ title: "Post", workspace_task_id: taskId }).workspace_task_id).toBe(taskId);
    expect(parseMarketingContentInput({ title: "Post", workspace_task_id: "outra-organizacao" }).workspace_task_id).toBeNull();
  });

  it("normaliza a criação automática da tarefa e suas etiquetas", () => {
    const tagId = "123e4567-e89b-42d3-a456-426614174000";
    const input = parseMarketingContentInput({
      title: "Post",
      create_workspace_task: true,
      workspace_tag_ids: [tagId, tagId, "tag-invalida"],
    });
    expect(input.create_workspace_task).toBe(true);
    expect(input.workspace_tag_ids).toEqual([tagId]);
  });

  it("mantém postagem e entrega como datas independentes", () => {
    const input = parseMarketingContentInput({
      title: "Post",
      scheduled_at: "2026-07-25T15:00:00.000Z",
      delivery_at: "2026-07-23T18:00:00.000Z",
    });
    expect(input.scheduled_at).toBe("2026-07-25T15:00:00.000Z");
    expect(input.delivery_at).toBe("2026-07-23T18:00:00.000Z");
  });
});

describe("marketingStats", () => {
  const base = { organization_id: "o", origin_idea_id: null, description: null, platform: "instagram", format: "reel", primary_assignee_id: null, priority: "medium", caption: null, script: null, cta: null, notes: null, thumbnail_url: null, reference_links: [], publication_url: null, manual_publication: false, post_publication_notes: null, created_by: "u", updated_by: null, created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z", archived_at: null, assignee_ids: [], asset_ids: [], checklist: [], comments: [], can_edit: true, can_delete: true } as const;
  it("calcula atrasos e conclusão apenas com dados internos", () => {
    const contents = [
      { ...base, id: "1", title: "Atrasado", status: "in_production", scheduled_at: "2026-07-10T12:00:00.000Z", published_at: null },
      { ...base, id: "2", title: "Publicado", status: "published", scheduled_at: "2026-07-12T12:00:00.000Z", published_at: "2026-07-12T13:00:00.000Z" },
    ] as unknown as MarketingContent[];
    expect(marketingStats(contents, new Date("2026-07-20T00:00:00.000Z"))).toEqual({ total: 2, overdue: 1, published: 1, completionRate: 50 });
  });
});
