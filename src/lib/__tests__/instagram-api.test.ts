import { afterEach, describe, expect, it, vi } from "vitest";
import { getInstagramAccountDailyExactMetrics } from "@/lib/instagram-api";

describe("getInstagramAccountDailyExactMetrics", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("consulta views usando exatamente o dia exibido, sem deslocar a série", async () => {
    const requested: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      requested.push(url);
      const metric = url.searchParams.get("metric");
      return new Response(JSON.stringify({
        data: metric === "views"
          ? [{ name: "views", total_value: { value: 3198 } }]
          : [{ name: "follows_and_unfollows", total_value: { breakdowns: [] } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const result = await getInstagramAccountDailyExactMetrics("account", "token", "2026-08-04", "2026-08-04");
    const viewsRequest = requested.find((url) => url.searchParams.get("metric") === "views");

    expect(viewsRequest?.searchParams.get("since")).toBe("2026-08-04");
    expect(viewsRequest?.searchParams.get("until")).toBe("2026-08-05");
    expect(result[0]).toMatchObject({ insight_date: "2026-08-04", views: 3198 });
  });
});
