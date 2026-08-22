import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getInstagramAccountDailyExactMetrics, replyToInstagramComment,
  sendInstagramMessage, subscribeInstagramWebhooks,
} from "@/lib/instagram-api";

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

describe("Instagram automation API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("subscribes the professional account to supported webhook fields", async () => {
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await subscribeInstagramWebhooks("ig-account", "token");
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toContain("/ig-account/subscribed_apps");
    expect(JSON.parse(String(init?.body))).toMatchObject({ subscribed_fields: expect.arrayContaining(["comments", "messages"]) });
  });

  it("uses the official public and private reply payloads", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo, _init?: RequestInit) => new Response(JSON.stringify(
      String(input).includes("/replies") ? { id: "reply" } : { message_id: "dm" },
    ), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await replyToInstagramComment("comment", "Te mandei no direct!", "token");
    await sendInstagramMessage("ig-account", { comment_id: "comment" }, "Olá", "token");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ message: "Te mandei no direct!" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      recipient: { comment_id: "comment" }, message: { text: "Olá" },
    });
  });
});
