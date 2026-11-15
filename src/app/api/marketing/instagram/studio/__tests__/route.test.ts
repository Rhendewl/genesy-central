// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
const mocks = vi.hoisted(() => ({ context: vi.fn(), from: vi.fn(), admin: vi.fn(), verify: vi.fn(), info: vi.fn(), download: vi.fn(), signed: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminSupabaseClient: mocks.admin }));
vi.mock("@/lib/marketing/server", async original => ({ ...await original<object>(), getMarketingServerContext: mocks.context }));
vi.mock("@/lib/crypto", () => ({ verifyState: mocks.verify, signState: () => "signed-ticket" }));
vi.mock("@/lib/marketing/editorial-instagram", () => ({ syncInstagramEditorial: vi.fn(async () => 0) }));
import { GET, POST, PATCH } from "../route";
import { POST as upload } from "../uploads/route";
const request = (body: unknown, method = "POST") => new NextRequest("https://test.local/api/marketing/instagram/studio", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const prefix = "marketing/org/instagram-studio/job/";
let chain: Record<string, ReturnType<typeof vi.fn>>;
let jpeg: Buffer;
beforeEach(async () => {
  vi.clearAllMocks(); jpeg = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#123456" } }).jpeg().toBuffer();
  mocks.context.mockResolvedValue({ isAdmin: true, organizationId: "org", user: { id: "user" } });
  mocks.verify.mockReturnValue({ purpose: "instagram-studio", id: "job", organizationId: "org", userId: "user", connectionId: "account", format: "image", assets: [{ path: prefix + "0.jpg", type: "image/jpeg", size: jpeg.length }], previewPath: prefix + "preview.jpg", previewSize: jpeg.length });
  chain = {}; for (const key of ["select", "eq", "order", "limit", "is", "update"]) chain[key] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockResolvedValueOnce({ data: null }).mockResolvedValue({ data: { id: "account", status: "connected", requested_scopes: ["instagram_business_content_publish"] } });
  chain.insert = vi.fn(async () => ({ error: null }));
  mocks.from.mockReturnValue(chain); mocks.admin.mockReturnValue({ from: mocks.from, storage: { from: () => ({ info: mocks.info, download: mocks.download, createSignedUrl: mocks.signed, createSignedUploadUrl: mocks.upload }) } });
  mocks.info.mockResolvedValue({ data: { size: jpeg.length, contentType: "image/jpeg" } }); mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(jpeg)]) }); mocks.upload.mockResolvedValue({ data: { token: "upload-token" } });
});
describe("Instagram studio authorization and queue", () => {
  it("rejects non-admin uploads, commits and reschedules before service access", async () => {
    mocks.context.mockResolvedValue({ isAdmin: false, organizationId: "org", user: { id: "user" } });
    for (const handler of [POST, PATCH, upload]) expect((await handler(request({}))).status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects a ticket owned by another organization or user", async () => {
    const ticket = mocks.verify(); for (const change of [{ organizationId: "other" }, { userId: "other" }]) { mocks.verify.mockReturnValue({ ...ticket, ...change }); expect((await POST(request({ ticket: "signed" }))).status).toBe(403); }
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects tampered or expired upload tickets", async () => { mocks.verify.mockImplementation(() => { throw new Error("Invalid signature"); }); expect((await POST(request({ ticket: "bad" }))).status).toBe(400); expect(mocks.from).not.toHaveBeenCalled(); });
  it("reuses an existing queued post when the commit is repeated", async () => {
    chain.maybeSingle.mockReset().mockResolvedValue({ data: { id: "job", status: "publishing" } });
    const res = await POST(request({ ticket: "signed" })); expect(res.status).toBe(200); expect((await res.json()).post.status).toBe("publishing"); expect(chain.insert).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled(); expect(chain.eq).toHaveBeenCalledWith("organization_id", "org");
  });
  it("validates stored files and enqueues without calling Meta", async () => {
    const res = await POST(request({ ticket: "signed", timing: "schedule", scheduledAt: "2099-11-14T15:30:00Z", caption: "Lançamento", altTexts: ["Fachada"] }));
    expect(res.status).toBe(201); expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ id: "job", organization_id: "org", connection_id: "account", media_kind: "feed", asset_types: ["image/jpeg"], preview_path: prefix + "preview.jpg", caption: "Lançamento", alt_texts: ["Fachada"], scheduled_at: "2099-11-14T15:30:00.000Z" }));
    expect(mocks.info).toHaveBeenCalledTimes(2);
  });
  it("rejects a file replaced after the upload was signed", async () => { mocks.info.mockResolvedValue({ data: { size: 1 } }); expect((await POST(request({ ticket: "signed", timing: "now" }))).status).toBe(400); expect(chain.insert).not.toHaveBeenCalled(); });
  it("rejects wrong image dimensions", async () => { const bytes = await sharp({create:{width:50,height:50,channels:3,background:"red"}}).jpeg().toBuffer(); mocks.download.mockResolvedValue({data:new Blob([new Uint8Array(bytes)])}); expect((await POST(request({ticket:"signed",timing:"now"}))).status).toBe(400);expect(chain.insert).not.toHaveBeenCalled(); });
  it("refuses a locked or already processed reschedule", async () => {
    chain.maybeSingle.mockReset().mockResolvedValue({data:null});expect((await PATCH(request({id:"job",action:"reschedule",scheduledAt:"2099-11-14T15:30:00Z"},"PATCH"))).status).toBe(409);expect(chain.eq).toHaveBeenCalledWith("organization_id","org");expect(chain.eq).toHaveBeenCalledWith("status","scheduled");expect(chain.is).toHaveBeenCalledWith("locked_until",null);
  });
  it("only signs valid formats for an accessible account", async () => {
    chain.maybeSingle.mockReset().mockResolvedValue({data:{id:"account",status:"connected",requested_scopes:["instagram_business_content_publish"]}});
    const res=await upload(request({connectionId:"account",format:"reel",assets:[{type:"video/mp4",size:1024}],previewSize:100}));expect(res.status).toBe(200);expect((await res.json()).uploads).toHaveLength(2);expect(chain.eq).toHaveBeenCalledWith("organization_id","org");
    expect((await upload(request({connectionId:"account",format:"reel",assets:[{type:"image/jpeg",size:10}],previewSize:100}))).status).toBe(400);
  });
  it("scopes every list query and never exposes credentials or internal paths",async()=>{
    Object.assign(chain,{then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(resolve)});
    const res=await GET(new NextRequest("https://test.local/api/marketing/instagram/studio"));expect(res.status).toBe(200);expect(chain.eq.mock.calls.filter(([key,value])=>key==="organization_id"&&value==="org")).toHaveLength(4);expect(chain.select.mock.calls.flat().join(" ")).not.toContain("encrypted_access_token");
  });
});

it.each(["reel","story"])("stores video %s in the same durable queue",async(format)=>{
 const ticket=mocks.verify();mocks.verify.mockReturnValue({...ticket,format,assets:[{path:prefix+"0.mp4",type:"video/mp4",size:1024}]});
 mocks.info.mockResolvedValueOnce({data:{size:1024,contentType:"video/mp4"}}).mockResolvedValueOnce({data:{size:jpeg.length,contentType:"image/jpeg"}});
 expect((await POST(request({ticket:"signed",timing:"now"}))).status).toBe(201);expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({media_kind:format,asset_types:["video/mp4"]}));
});
it("strips storage paths and asset manifests from the library response",async()=>{
 const post={id:"job",connection_id:"account",scheduled_at:"2099-11-14T15:30:00Z",caption:"Post",status:"scheduled",published_at:null,media_kind:"reel",media_id:null,last_error:null,paths:[prefix+"0.mp4"],asset_types:["video/mp4"],preview_path:prefix+"preview.jpg"};
 mocks.from.mockImplementation((table:string)=>{const q:Record<string,unknown>={};for(const key of ["select","eq","order","limit"])q[key]=()=>q;q.then=(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:table==="marketing_instagram_scheduled_posts"?[post]:[],error:null}).then(resolve);return q;});
 mocks.signed.mockResolvedValue({data:{signedUrl:"https://signed.test/preview"}});
 const response=await GET(new NextRequest("https://test.local/api/marketing/instagram/studio"));const result=await response.json();expect(result.posts[0]).toMatchObject({format:"reel",asset_count:1,preview_url:"https://signed.test/preview"});expect(result.posts[0]).not.toHaveProperty("paths");expect(result.posts[0]).not.toHaveProperty("asset_types");expect(result.posts[0]).not.toHaveProperty("preview_path");expect(result.posts[0]).not.toHaveProperty("asset_urls");
});
