// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  rankPosts,
  normalizeUsername,
  publicCount,
  safeInstagramLink,
  type CompetitorPost,
} from "../competitor-domain";
import { discover, discoveryConfig } from "../competitor-discovery";
const post = (
  id: string,
  n: number | null,
  profile = "a",
  format = "IMAGE",
): CompetitorPost => ({
  id,
  profile_id: profile,
  media_type: format,
  caption: "Legenda",
  permalink: null,
  published_at: "2026-10-20T00:00:00Z",
  like_count: n,
  comments_count: 0,
  collected_at: "2026-10-29T00:00:00Z",
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Public performance", () => {
  it("isolates profiles and formats, keeps missing metrics out of the mean", () => {
    const ranked = rankPosts([
      post("1", 10),
      post("2", 10),
      post("3", 10),
      post("4", 10),
      post("5", 60),
      post("6", null),
      post("7", 900, "b"),
      post("8", 900, "a", "VIDEO"),
    ]);
    expect(ranked[0].score).toBe(3);
    expect(ranked[0].baseline).toBe(20);
    expect(ranked[0].sample).toBe(5);
    expect(ranked.find((p) => p.id === "6")?.interactions).toBeNull();
    expect(ranked.find((p) => p.id === "7")?.score).toBeNull();
    expect(ranked.find((p) => p.id === "8")?.score).toBeNull();
  });
  it("does not divide by zero or rank a small sample", () => {
    expect(rankPosts([post("1", 10)])[0].score).toBeNull();
    expect(
      rankPosts(Array.from({ length: 5 }, (_, i) => post(String(i), 0)))[0]
        .score,
    ).toBeNull();
  });
  it("validates usernames and numeric counts without fabricating zero", () => {
    expect(normalizeUsername(" @Genesy_Oficial ")).toBe("genesy_oficial");
    for (const bad of ["https://instagram.com/a", "x){id}", "a..b", "", null])
      expect(() => normalizeUsername(bad)).toThrow();
    for (const bad of [undefined, null, -1, NaN, "12", 1.2])
      expect(publicCount(bad)).toBeNull();
    expect(publicCount(0)).toBe(0);
    expect(safeInstagramLink("javascript:alert(1)")).toBeNull();
    expect(safeInstagramLink("https://evil.com/p/a")).toBeNull();
  });
});
function env() {
  vi.stubEnv("META_DISCOVERY_ACCESS_TOKEN", "secret");
  vi.stubEnv("META_DISCOVERY_IG_USER_ID", "123");
  vi.stubEnv("META_DISCOVERY_GRAPH_VERSION", "v24.0");
  vi.stubEnv("META_DISCOVERY_ORGANIZATION_ID", "org");
}
describe("Official discovery boundary", () => {
  it("never lends credentials to another organization", () => {
    env();
    expect(() => discoveryConfig("other")).toThrow();
  });
  it("uses Facebook Graph, caps collection, and preserves unavailable metrics", async () => {
    env();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            business_discovery: {
              id: "9",
              username: "target",
              media: {
                data: [
                  {
                    id: "1",
                    timestamp: "2026-10-20",
                    media_type: "IMAGE",
                    like_count: 4,
                  },
                ],
                paging: { next: "https://evil.test" },
              },
            },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await discover("org", "target");
    expect(result.posts[0].comments_count).toBeNull();
    expect(result.partial).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, opts] = fetcher.mock.calls[0];
    expect(url.origin).toBe("https://graph.facebook.com");
    expect(url.searchParams.get("fields")).toContain("media.limit(50)");
    expect(url.href).not.toContain("secret");
    expect(opts.headers.Authorization).toBe("Bearer secret");
  });
  it("sanitizes API errors and stops on rate limits", async () => {
    env();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: 4, message: "secret" } }),
            { status: 400 },
          ),
        ),
    );
    await expect(discover("org", "target")).rejects.toMatchObject({
      status: 429,
    });
  });
  it("classifies unavailable profiles instead of synthesizing results", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(discover("org", "target")).rejects.toMatchObject({
      status: 404,
    });
  });
});

it("accepts only Meta image hosts and canonical Instagram embed paths", async () => {
 const {safeMediaPreview,instagramEmbed}=await import("../competitor-domain");
 expect(safeMediaPreview("https://scontent.cdninstagram.com/photo.jpg?sig=x")).toContain("cdninstagram.com");
 for(const url of ["http://scontent.fbcdn.net/a", "https://cdninstagram.com.evil.test/a", "https://user:secret@scontent.fbcdn.net/a", "https://scontent.fbcdn.net/a?access_token=secret", "javascript:alert(1)"]) expect(safeMediaPreview(url)).toBeNull();
 expect(instagramEmbed("https://www.instagram.com/p/Abc_12/?tracking=x")).toBe("https://www.instagram.com/p/Abc_12/embed/");
 expect(instagramEmbed("https://www.instagram.com/accounts/login/")).toBeNull();
});
