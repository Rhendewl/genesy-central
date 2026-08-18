import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authorizePortalAccess } = vi.hoisted(() => ({ authorizePortalAccess: vi.fn() }));

vi.mock("@/lib/portal-access", () => ({
  authorizePortalAccess,
  portalNoStoreHeaders: () => ({ "Cache-Control": "private, no-store, max-age=0" }),
}));

import { GET as getData } from "@/app/api/portal/[slug]/data/route";
import { GET as getCreatives } from "@/app/api/portal/[slug]/creatives/route";
import { GET as getBalance } from "@/app/api/portal/[slug]/balance/route";
import { POST as refresh } from "@/app/api/portal/[slug]/refresh/route";

const context = { params: Promise.resolve({ slug: "portal-auditado" }) };

describe("protected portal endpoints", () => {
  beforeEach(() => {
    authorizePortalAccess.mockReset();
    authorizePortalAccess.mockResolvedValue({ ok: false, status: 401, error: "Link seguro necessário" });
  });

  it.each([
    ["data", () => getData(new NextRequest("https://dash.example.com/api/portal/portal-auditado/data"), context)],
    ["creatives", () => getCreatives(new NextRequest("https://dash.example.com/api/portal/portal-auditado/creatives"), context)],
    ["balance", () => getBalance(new NextRequest("https://dash.example.com/api/portal/portal-auditado/balance"), context)],
    ["refresh", () => refresh(new NextRequest("https://dash.example.com/api/portal/portal-auditado/refresh", { method: "POST", body: "{}" }), context)],
  ])("rejects slug-only access to %s before loading portal data", async (_name, invoke) => {
    const response = await invoke();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Link seguro necessário" });
    expect(authorizePortalAccess).toHaveBeenCalledTimes(1);
  });
});
