import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  authorizePortalAccess,
  generatePortalAccessToken,
  getPortalAccessToken,
  hashPortalAccessToken,
  portalAccessCookieName,
  portalNoStoreHeaders,
} from "@/lib/portal-access";

describe("portal access security", () => {
  it("generates high-entropy opaque tokens", () => {
    const first = generatePortalAccessToken();
    const second = generatePortalAccessToken();
    expect(first).toMatch(/^gptl_[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("stores a deterministic hash instead of the raw token", () => {
    const token = generatePortalAccessToken();
    const hash = hashPortalAccessToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashPortalAccessToken(token)).toBe(hash);
  });

  it("isolates cookies by portal slug", () => {
    expect(portalAccessCookieName("portal-a")).not.toBe(portalAccessCookieName("portal-b"));
    expect(portalAccessCookieName("portal-a")).toBe(portalAccessCookieName("portal-a"));
  });

  it("accepts the portal cookie and gives precedence to a bearer credential", () => {
    const slug = "cliente-seguro";
    const cookieToken = generatePortalAccessToken();
    const cookieRequest = new NextRequest("https://dash.example.com/api/portal/cliente-seguro/data", {
      headers: { cookie: `${portalAccessCookieName(slug)}=${cookieToken}` },
    });
    expect(getPortalAccessToken(cookieRequest, slug)).toBe(cookieToken);

    const bearerToken = generatePortalAccessToken();
    const bearerRequest = new NextRequest("https://dash.example.com/api/portal/cliente-seguro/data", {
      headers: {
        authorization: `Bearer ${bearerToken}`,
        cookie: `${portalAccessCookieName(slug)}=${cookieToken}`,
      },
    });
    expect(getPortalAccessToken(bearerRequest, slug)).toBe(bearerToken);
  });

  it("rejects a slug without a credential before requiring database access", async () => {
    const request = new NextRequest("https://dash.example.com/api/portal/slug-only/data");
    await expect(authorizePortalAccess(request, "slug-only")).resolves.toMatchObject({
      ok: false,
      status: 401,
      error: "Link seguro necessário",
    });
  });

  it("marks all protected responses as private and non-cacheable", () => {
    expect(portalNoStoreHeaders()).toMatchObject({
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    });
  });
});
