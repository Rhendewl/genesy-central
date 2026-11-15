// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { editorialInstagramRecord, instagramEditorialId, syncInstagramEditorial, type EditorialInstagramPost } from "../editorial-instagram";
const job: EditorialInstagramPost = { id: "job", organization_id: "org", created_by: "user", caption: "Meu post\nLegenda", paths: ["a", "b"], status: "scheduled", scheduled_at: "2026-11-01T15:00:00Z", published_at: null, last_error: null };
describe("Instagram editorial integration", () => {
  it("uses the same id for scheduled and published versions of a post", () => {
    const planned = editorialInstagramRecord(job);
    const published = editorialInstagramRecord({ ...job, status: "published", published_at: "2026-11-01T15:03:00Z" });
    expect(planned).toMatchObject({ id: "job", status: "scheduled", format: "carousel", scheduled_at: job.scheduled_at, manual_publication: false });
    expect(published).toMatchObject({ id: "job", status: "published", published_at: "2026-11-01T15:03:00Z", scheduled_at: "2026-11-01T15:03:00Z" });
  });
  it("does not count cancelled or failed sends as scheduled or published", () => {
    expect(editorialInstagramRecord({ ...job, status: "cancelled" }).status).toBe("cancelled");
    expect(editorialInstagramRecord({ ...job, status: "failed", last_error: "Reconecte" })).toMatchObject({ status: "planned", published_at: null, notes: expect.stringContaining("Reconecte") });
  });
  it("distinguishes stories and static posts", () => {
    expect(editorialInstagramRecord({ ...job, media_kind: "reel", paths: ["video"] }).format).toBe("reel");
    expect(editorialInstagramRecord({ ...job, media_kind: "story", paths: ["image"] }).format).toBe("story");
    expect(editorialInstagramRecord({ ...job, paths: ["a"] }).format).toBe("static_post");
    expect(editorialInstagramRecord({ ...job, paths: ["marketing/org/instagram-stories/a.jpg"] }).format).toBe("story");
  });
  it("deduplicates retries by container and isolates organizations", () => {
    expect(instagramEditorialId("org", "container")).toBe(instagramEditorialId("org", "container"));
    expect(instagramEditorialId("org", "container")).not.toBe(instagramEditorialId("other", "container"));
    expect(instagramEditorialId("org", "container")).toMatch(/^[a-f0-9-]{36}$/);
  });
  it("backfills earlier schedules and does not rewrite unchanged editorial records", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    let existing: Record<string, unknown>[] = [];
    const ledgerChain: Record<string, unknown> = {};
    for (const method of ["select", "order", "eq"]) ledgerChain[method] = vi.fn(() => ledgerChain);
    ledgerChain.range = vi.fn(() => ledgerChain);
    ledgerChain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [job], error: null }).then(resolve);
    const db = { from: vi.fn((table) => table === "marketing_instagram_scheduled_posts" ? ledgerChain : { select: () => ({ in: async () => ({ data: existing, error: null }) }), upsert }) } as unknown as SupabaseClient;
    expect(await syncInstagramEditorial(db, "org")).toBe(1);
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ id: "job", status: "scheduled" })], { onConflict: "id" });
    existing = [editorialInstagramRecord(job)]; upsert.mockClear();
    expect(await syncInstagramEditorial(db, "org")).toBe(0); expect(upsert).not.toHaveBeenCalled();
  });
});

it("rejects incomplete editorial tenant data before any database write",()=>{expect(()=>editorialInstagramRecord({...job,organization_id:""})).toThrow("organização");expect(()=>editorialInstagramRecord({...job,created_by:""})).toThrow("autoria");expect(editorialInstagramRecord(job)).toMatchObject({organization_id:"org",created_by:"user"});});
