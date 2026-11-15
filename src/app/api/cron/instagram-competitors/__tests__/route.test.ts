// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ready: vi.fn(), admin: vi.fn(), discover: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminSupabaseClient: m.admin }));
vi.mock("@/lib/marketing/competitor-discovery", () => ({
  discoveryReady: m.ready,
  discover:m.discover,
}));
import { GET, POST } from "../route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "cron-test");
  vi.stubEnv("META_DISCOVERY_ORGANIZATION_ID", "org");
  vi.stubEnv(
    "INSTAGRAM_SCHEDULER_SECRET_SHA256",
    createHash("sha256").update("vault-test").digest("hex"),
  );
  m.ready.mockReturnValue(false);
});
afterEach(() => vi.unstubAllEnvs());
it("rejects missing and invalid authentication", async () => {
  expect((await GET(new NextRequest("https://test.local"))).status).toBe(401);
  expect(
    (
      await POST(
        new NextRequest("https://test.local", {
          headers: { "x-cron-secret": "wrong" },
        }),
      )
    ).status,
  ).toBe(401);
  expect(m.admin).not.toHaveBeenCalled();
});
it("accepts the existing Vault scheduler without exposing or replacing the secret", async () => {
  const r = await POST(
    new NextRequest("https://test.local", {
      headers: { "x-cron-secret": "vault-test" },
    }),
  );
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ skipped: true });
  expect(m.admin).not.toHaveBeenCalled();
});
it("also accepts the standard bearer cron secret", async () => {
  expect(
    (
      await GET(
        new NextRequest("https://test.local", {
          headers: { authorization: "Bearer cron-test" },
        }),
      )
    ).status,
  ).toBe(200);
});

it("scopes read-only maintenance diagnostics and never claims or saves a collection",async()=>{
 m.ready.mockReturnValue(true);const q:any={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:{username:"target"},error:null})};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);const db={from:vi.fn(()=>q),rpc:vi.fn()};m.admin.mockReturnValue(db);m.discover.mockResolvedValue({username:"target",posts:[{id:"1"}]});const r=await POST(new NextRequest("https://test.local?diagnose=11111111-1111-4111-8111-111111111111",{headers:{"x-cron-secret":"vault-test"}}));expect(await r.json()).toMatchObject({diagnostic:true,available:true,publicPosts:1});expect(q.eq).toHaveBeenCalledWith("organization_id","org");expect(m.discover).toHaveBeenCalledWith("org","target");expect(db.rpc).not.toHaveBeenCalled();
});
it("never diagnoses a profile from another organization",async()=>{
 m.ready.mockReturnValue(true);const q:any={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null})};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);m.admin.mockReturnValue({from:()=>q});const r=await POST(new NextRequest("https://test.local?diagnose=11111111-1111-4111-8111-111111111111",{headers:{"x-cron-secret":"vault-test"}}));expect(r.status).toBe(404);expect(m.discover).not.toHaveBeenCalled();
});
