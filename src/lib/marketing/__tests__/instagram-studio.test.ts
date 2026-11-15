// @vitest-environment node
import { describe, expect, it } from "vitest";
import { studioDateKey, studioSchedule, validateStudioAssets } from "../instagram-studio";
const image = { type: "image/jpeg", size: 2048 }, video = { type: "video/mp4", size: 1024 };
describe("Instagram studio publishing constraints", () => {
  it("keeps dates in Fortaleza even across UTC midnight", () => { expect(studioDateKey("2026-11-14T01:00:00Z")).toBe("2026-11-13"); expect(studioSchedule("2099-11-14T12:30")).toBe("2099-11-14T15:30:00.000Z"); });
  it("rejects impossible dates and schedules less than five minutes away", () => { expect(() => studioSchedule("2099-02-30T12:30")).toThrow(); expect(() => studioSchedule("2026-11-14T12:03", Date.parse("2026-11-14T15:00:00Z"))).toThrow(); });
  it("supports images, ordered carousels, Reels and image/video Stories", () => { for (const [format, assets] of [["image", [image]], ["carousel", [image, image]], ["reel", [video]], ["story", [image]], ["story", [video]]]) expect(() => validateStudioAssets(format, assets)).not.toThrow(); });
  it.each([["carousel", [image]], ["reel", [image]], ["image", [video]], ["story", [image, image]], ["carousel", Array(11).fill(image)], ["reel", [{ ...video, size: 51 * 1024 * 1024 }]], ["image", [{ ...image, size: -2 }]], ["__proto__", [image]]])("blocks incompatible %s media", (format, assets) => { expect(() => validateStudioAssets(format, assets)).toThrow(); });
});

it("migrates legacy feed rows without changing service-only access",async()=>{
 const {PGlite}=await import("@electric-sql/pglite");const {readFile}=await import("node:fs/promises");const db=new PGlite();
 try{
 await db.exec("CREATE ROLE authenticated; CREATE TABLE public.marketing_instagram_scheduled_posts (id text PRIMARY KEY, paths text[] NOT NULL); ALTER TABLE public.marketing_instagram_scheduled_posts ENABLE ROW LEVEL SECURITY; INSERT INTO public.marketing_instagram_scheduled_posts VALUES ('legacy', ARRAY['slide.jpg']);");
 await db.exec(await readFile("supabase/migrations/20261114003000_instagram_studio.sql","utf8"));
 expect((await db.query("SELECT media_kind,asset_types,preview_path FROM public.marketing_instagram_scheduled_posts")).rows).toEqual([{media_kind:"feed",asset_types:[],preview_path:null}]);
 expect((await db.query("SELECT has_table_privilege('authenticated','public.marketing_instagram_scheduled_posts','SELECT') AS allowed")).rows).toEqual([{allowed:false}]);
 await expect(db.exec("UPDATE public.marketing_instagram_scheduled_posts SET media_kind='unknown'")).rejects.toThrow();
 }finally{await db.close();}
});
