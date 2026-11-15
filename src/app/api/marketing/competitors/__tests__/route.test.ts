// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  context: vi.fn(),
  admin: vi.fn(),
  from: vi.fn(),
  sync: vi.fn(),
}));
vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: async () => ({ from: m.from }),
}));
vi.mock("@/lib/supabase-admin", () => ({ createAdminSupabaseClient: m.admin }));
vi.mock("@/lib/marketing/server", async (original) => ({
  ...(await original<object>()),
  getMarketingServerContext: m.context,
}));
vi.mock("@/lib/marketing/competitor-sync", () => ({ syncCompetitor: m.sync }));
import { POST, GET } from "../route";
const id = "11111111-1111-4111-8111-111111111111";
const request = (body: unknown) =>
  new NextRequest("https://test.local/api/marketing/competitors", {
    method: "POST",
    body: JSON.stringify(body),
  });
const chain = {
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  insert: vi.fn(),
  single: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  m.context.mockResolvedValue({ isAdmin: true, organizationId: "org" });
  m.admin.mockReturnValue({ from: m.from });
  m.from.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue({ data: { id }, error: null });
  chain.insert.mockReturnValue(chain);
  chain.single.mockResolvedValue({data:{id,username:"test"},error:null});
  m.sync.mockResolvedValue({ collected: 2 });
});
describe("Competitor authorization", () => {
  it("rejects non-admin writes before service access", async () => {
    m.context.mockResolvedValue({ isAdmin: false, organizationId: "org" });
    expect((await POST(request({ action: "sync", id }))).status).toBe(403);
    expect(m.admin).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated reads", async () => {
    m.context.mockRejectedValue(
      Object.assign(new Error("Não autenticado"), { status: 401 }),
    );
    expect((await GET(new NextRequest("https://test.local"))).status).toBe(401);
    expect(m.from).not.toHaveBeenCalled();
  });
  it("does not sync foreign or missing profiles", async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await POST(request({ action: "sync", id }))).status).toBe(404);
    expect(chain.eq).toHaveBeenCalledWith("organization_id", "org");
    expect(m.sync).not.toHaveBeenCalled();
  });
  it("uses the authenticated org, ignoring an injected org", async () => {
    expect(
      (await POST(request({ action: "sync", id, organization_id: "victim" })))
        .status,
    ).toBe(200);
    expect(m.sync).toHaveBeenCalledWith(expect.anything(), "org", id);
  });
  it("does not accept arbitrary actions or invalid IDs", async () => {
    expect((await POST(request({ action: "drop" }))).status).toBe(400);
    expect((await POST(request({ action: "delete", id: "x" }))).status).toBe(
      400,
    );
  });
  it("requires an explicit boolean when pausing", async () => {
    expect(
      (await POST(request({ action: "toggle", id, active: "false" }))).status,
    ).toBe(400);
  });
  it("maps duplicate registration to conflict", async () => {
    chain.single.mockResolvedValue({ data:null,error: { code: "23505" } });
    expect(
      (await POST(request({ action: "add", username: "@test" }))).status,
    ).toBe(409);
  });
});

it("rejects the removed AI action before any service access", async () => {
  expect((await POST(request({ action: "analyze", id }))).status).toBe(400);
  expect(m.admin).not.toHaveBeenCalled();
});

it("registers a profile link and starts a scoped first collection when explicitly requested",async()=>{
 const r=await POST(request({action:"add",username:"https://www.instagram.com/Test/?igsh=x",collect:true,organization_id:"foreign"}));expect(r.status).toBe(201);expect(await r.json()).toMatchObject({profile:{id},collection:{success:true,collected:2}});expect(chain.insert).toHaveBeenCalledWith({organization_id:"org",username:"test"});expect(m.sync).toHaveBeenCalledWith(expect.anything(),"org",id);
});
it("keeps a successfully registered profile when the first official collection fails",async()=>{
 m.sync.mockRejectedValue(Object.assign(new Error("Perfil indisponível"),{status:404}));const r=await POST(request({action:"add",username:"test",collect:true}));expect(r.status).toBe(201);expect(await r.json()).toMatchObject({profile:{id},collection:{success:false,error:"Perfil indisponível"}});
});
it("does not collect without the explicit add-and-collect action",async()=>{expect((await POST(request({action:"add",username:"test"}))).status).toBe(201);expect(m.sync).not.toHaveBeenCalled();});
