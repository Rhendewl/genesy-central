// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const meta = vi.hoisted(() => ({ image: vi.fn(), story: vi.fn(), video: vi.fn(), carousel: vi.fn(), status: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ decryptToken: () => "token" }));
vi.mock("@/lib/instagram-api", () => ({ createInstagramFeedImage: meta.image, createInstagramStory: meta.story, createInstagramVideo: meta.video, createInstagramCarousel: meta.carousel, getInstagramContainerStatus: meta.status, publishInstagramStory: meta.publish }));
import { runScheduledInstagramPost } from "../instagram-scheduler";
const job = { id: "job", organization_id: "org", connection_id: "account", locked_until: "lease", children: ["one", "two"], paths: ["a", "b"], caption: "Legenda", alt_texts: [], attempts: 0 };
function database(value: object | null = job) {
  const patches: Record<string, unknown>[] = [];
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const key of ["select", "eq", "update"]) chain[key] = vi.fn(() => chain);
  chain.update.mockImplementation((patch) => { patches.push(patch); return chain; });
  chain.single = vi.fn(async () => ({ data: { instagram_user_id: "ig", requested_scopes: ["instagram_business_content_publish"], encrypted_access_token: "encrypted" } }));
  const remove = vi.fn(async () => ({}));
  const db = { rpc: vi.fn(async () => ({ data: value ? [value] : [] })), from: vi.fn(() => chain), storage: { from: () => ({ remove, createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://asset.test/media" } })) }) } };
  return { db: db as unknown as SupabaseClient, patches, remove };
}
describe("scheduled Instagram publication", () => {
  beforeEach(() => { vi.clearAllMocks(); meta.carousel.mockResolvedValue({ id: "parent" }); meta.publish.mockResolvedValue({ id: "media" }); });
  it("does not call Instagram when there are no due jobs", async () => {
    const { db } = database(null); expect(await runScheduledInstagramPost(db)).toEqual({ processed: 0 }); expect(meta.status).not.toHaveBeenCalled();
  });
  it("saves the parent container before publishing and keeps slide order", async () => {
    const { db, patches, remove } = database(); meta.status.mockResolvedValue({ status_code: "FINISHED" });
    meta.publish.mockImplementation(async () => { expect(patches).toContainEqual({ container_id: "parent" }); return { id: "media" }; });
    expect(await runScheduledInstagramPost(db)).toEqual({ processed: 1, published: true });
    expect(meta.carousel).toHaveBeenCalledWith("ig", "token", ["one", "two"], "Legenda");
    expect(patches.some((patch) => patch.status === "published")).toBe(true); expect(remove).toHaveBeenCalledWith(["a", "b"]);
  });
  it("reconciles a previously published container without republishing", async () => {
    const { db } = database({ ...job, container_id: "existing" }); meta.status.mockResolvedValue({ status_code: "PUBLISHED" });
    expect(await runScheduledInstagramPost(db)).toEqual({ processed: 1, published: true });
    expect(meta.publish).not.toHaveBeenCalled(); expect(meta.carousel).not.toHaveBeenCalled();
  });
  it("retries the same container after uncertain publication without deleting images", async () => {
    const { db, patches, remove } = database({ ...job, container_id: "existing" }); meta.status.mockResolvedValue({ status_code: "FINISHED" }); meta.publish.mockRejectedValue(new Error("timeout"));
    await runScheduledInstagramPost(db);
    expect(meta.publish).toHaveBeenCalledWith("ig", "token", "existing"); expect(remove).not.toHaveBeenCalled();
    expect(patches.at(-1)).toMatchObject({ status: "publishing", attempts: 1, last_error: "timeout", locked_until: null });
  });
  it("leaves processing images for the next tick without publishing prematurely", async () => {
    const { db, patches } = database(); meta.status.mockResolvedValue({ status_code: "IN_PROGRESS" });
    expect(await runScheduledInstagramPost(db)).toEqual({ processed: 1, processing: true });
    expect(patches.at(-1)).toMatchObject({ locked_until: null }); expect(meta.publish).not.toHaveBeenCalled();
  });
});

it.each([
  ["reel", "video/mp4", "video"], ["story", "video/mp4", "video"], ["story", "image/jpeg", "story"],
])("publishes %s %s with the matching Meta container", async (media_kind, type, method) => {
  vi.clearAllMocks(); meta.video.mockResolvedValue({id:"video-container"}); meta.story.mockResolvedValue({id:"story-container"}); meta.status.mockResolvedValue({status_code:"FINISHED"}); meta.publish.mockResolvedValue({id:"published"});
  const {db,remove}=database({...job,paths:["asset"],children:[],media_kind,asset_types:[type]});
  expect(await runScheduledInstagramPost(db)).toEqual({processed:1,published:true});
  if(method==="video") expect(meta.video).toHaveBeenCalledWith("ig","token","https://asset.test/media",{story:media_kind==="story",caption:"Legenda"});
  else expect(meta.story).toHaveBeenCalledWith("ig","token","https://asset.test/media");
  expect(meta.image).not.toHaveBeenCalled(); expect(meta.carousel).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledWith(["asset"]);
});
it("reconciles a checkpointed Reel even when its child checkpoint is missing",async()=>{
  vi.clearAllMocks();meta.status.mockResolvedValue({status_code:"PUBLISHED"});
  const {db}=database({...job,paths:["video"],children:[],container_id:"existing",media_kind:"reel",asset_types:["video/mp4"]});
  expect(await runScheduledInstagramPost(db)).toEqual({processed:1,published:true});expect(meta.video).not.toHaveBeenCalled();expect(meta.publish).not.toHaveBeenCalled();
});
