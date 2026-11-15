import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/components/marketing/InstagramReports", () => ({ InstagramGlyph: () => createElement("span", null, "◎") }));
vi.mock("@/components/marketing/InstagramAutomations", () => ({ InstagramAutomations: ({accountId}:{accountId:string}) => createElement("div", null, `Automações de ${accountId}`) }));
vi.mock("@/components/ui/dialog", () => ({ Dialog: ({ children }: { children: React.ReactNode }) => createElement("div", null, children), DialogContent: ({ children }: { children: React.ReactNode }) => createElement("div", {className:"test-dialog"}, children), DialogTitle: ({ children }: { children: React.ReactNode }) => createElement("h2", null, children) }));
vi.mock("@/hooks/useModalOpen", () => ({useModalOpen:vi.fn()}));
const mocks = vi.hoisted(() => ({ upload: vi.fn(), prepare: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) } }) }));
vi.mock("@/lib/marketing/instagram-studio-media", () => ({ prepareStudioImage: mocks.prepare, prepareStudioVideo: mocks.prepare }));
vi.mock("sonner", () => ({toast:{success:vi.fn()}}));
import { InstagramStudio } from "../instagram/InstagramStudio";
import { InstagramComposer } from "../instagram/InstagramComposer";
const accounts = [{id:"a",username:"genesy",can_publish:true,status:"connected",profile_picture_url:null,webhook_subscribed:true},{id:"b",username:"outro_perfil",can_publish:true,status:"connected",profile_picture_url:null,webhook_subscribed:true}];
const base = {is_admin:true,connections:accounts,posts:[{id:"p",connection_id:"a",caption:"Post do primeiro perfil",status:"scheduled",scheduled_at:"2099-11-14T15:00:00Z",published_at:null,media_kind:"feed",media_id:null,asset_count:1,preview_url:null,format:"image",last_error:null}],media:[],automations:[]};
let root:Root, host:HTMLDivElement;
const json=(v:unknown)=>new Response(JSON.stringify(v),{status:200});
function button(text:string){return Array.from(host.querySelectorAll("button")).find(b=>b.textContent===text)!;}
async function change(element:HTMLInputElement|HTMLSelectElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,"value")!.set!.call(element,value);element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change":"input",{bubbles:true}));});}
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement("div");document.body.append(host);root=createRoot(host);vi.stubGlobal("fetch",vi.fn(async()=>json(base)));vi.stubGlobal("URL",Object.assign(URL,{revokeObjectURL:vi.fn()}));mocks.upload.mockResolvedValue({error:null});mocks.prepare.mockImplementation(async(source:File)=>({id:source.name,source,file:new Blob(["jpeg"],{type:"image/jpeg"}),poster:new Blob(["thumb"],{type:"image/jpeg"}),url:"blob:preview",type:"image/jpeg",altText:""}));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.clearAllMocks();});
describe("Instagram studio interaction",()=>{
  it("filters publications and automations when switching accounts",async()=>{
    await act(async()=>root.render(createElement(InstagramStudio)));
    expect(host.textContent).toContain("Post do primeiro perfil");
    await change(host.querySelector('[aria-label="Conta do Instagram"]')!,"b");expect(host.textContent).not.toContain("Post do primeiro perfil");
    await act(async()=>button("Automações").click());expect(host.textContent).toContain("Automações de b");
  });
  it("shows freshly confirmed posts before the media sync has run",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>json({...base,posts:[{...base.posts[0],status:"published",published_at:"2026-11-14T15:30:00Z",media_id:"confirmed"}]})));
    await act(async()=>root.render(createElement(InstagramStudio)));expect(host.querySelector(".ig-post-card")?.textContent).toContain("Publicado");expect(host.textContent).not.toContain("Nenhuma publicação sincronizada");
  });
  it("does not offer creation to read-only members",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>json({...base,is_admin:false,posts:[]})));await act(async()=>root.render(createElement(InstagramStudio)));expect(button("Nova publicação").disabled).toBe(true);expect(host.textContent).toContain("administradores");
  });
  it("reviews media before any request and reuses the same ticket after an uncertain commit",async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(json({ticket:"ticket",uploads:[{path:"original",token:"one",type:"image/jpeg"},{path:"preview",token:"two",type:"image/jpeg"}]})).mockRejectedValueOnce(new Error("Conexão interrompida")).mockResolvedValueOnce(json({post:{id:"same-post"}}));vi.stubGlobal("fetch",fetcher);
    const close=vi.fn();await act(async()=>root.render(createElement(InstagramComposer,{connections:accounts,accountId:"a",initialFormat:"image",onClose:close,onSaved:vi.fn()})));
    const fileInput=host.querySelector('input[type="file"]') as HTMLInputElement;Object.defineProperty(fileInput,"files",{value:[new File(["source"],"fachada.jpg",{type:"image/jpeg"})]});await act(async()=>fileInput.dispatchEvent(new Event("change",{bubbles:true})));
    await act(async()=>button("Revisar publicação").click());expect(fetcher).not.toHaveBeenCalled();expect(host.querySelector("img")?.getAttribute("src")).toBe("blob:preview");
    await act(async()=>button("Confirmar publicação").click());expect(host.textContent).toContain("Conexão interrompida");expect(close).not.toHaveBeenCalled();
    await act(async()=>button("Verificar envio").click());expect(close).toHaveBeenCalledOnce();expect(fetcher).toHaveBeenCalledTimes(3);expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[2][1].body);expect(mocks.upload).toHaveBeenCalledTimes(2);
  });
});
