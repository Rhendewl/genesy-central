import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/components/layout/Header", () => ({
  Header: ({ title,actions }: { title: string;actions?:import("react").ReactNode }) => createElement("header",null,createElement("h1", null, title),createElement("div",{className:"radar-header-actions-test"},actions)),
}));
import Page from "@/app/marketing/concorrentes/page";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const empty = {
  profiles: [],
  posts: [],
  history: [],
  configured: false,
  isAdmin: true,
  truncated: false,
};
it("shows honest configuration and empty states without fictitious data", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(empty))),
  );
  await act(async () => root.render(createElement(Page)));
  expect(host.textContent).toContain("Conexão Business Discovery pendente");
  expect(host.textContent).toContain("Seu radar começa com um perfil");
  expect(host.querySelector("table")).toBeNull();
  expect(host.textContent).not.toContain("Análise com IA");
});
it("hides management actions from read-only members", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...empty, isAdmin: false })),
      ),
  );
  await act(async () => root.render(createElement(Page)));
  expect(host.querySelector("form")).toBeNull();
});
it("shows a recoverable API failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Migração pendente" }), {
        status: 503,
      }),
    ),
  );
  await act(async () => root.render(createElement(Page)));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "Migração pendente",
  );
});

it("renders supplied public data and selects analysis through profile cards", async () => {
  const fixture = {
    ...empty,
    configured: true,
    profiles: [
      {
        id: "p",
        username: "perfil_teste",
        active: true,
        followers_count: 1200,
        last_sync_at: "2026-10-29T12:00:00Z",
        next_sync_at: "2026-10-30T12:00:00Z",
        partial: true,
      },
    ],
    posts: [
      {
        id: "1",
        profile_id: "p",
        media_type: "IMAGE",
        caption: "Como escolher um imóvel para sua família?",
        permalink: "https://www.instagram.com/p/test/",
        published_at: "2026-10-20T12:00:00Z",
        collected_at: "2026-10-29T12:00:00Z",
        like_count: 90,
        comments_count: 10,
        interactions: 100,
        baseline: 50,
        sample: 5,
        score: 2,
      },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify(fixture))),
  );
  await act(async () => root.render(createElement(Page)));
  expect(host.textContent).toContain("2× a média");
  expect(host.querySelectorAll("article")).toHaveLength(1);
  const inspect = Array.from(host.querySelectorAll("button")).find(b=>b.textContent?.trim() === "Ver dados e legenda")!;
  await act(async () => inspect.click());
  expect(document.querySelector('a[target="_blank"]')?.getAttribute("rel")).toBe(
    "noopener noreferrer",
  );
  expect(document.body.textContent).toContain("Gancho".toUpperCase());
  await act(async () => (document.querySelector('[aria-label="Fechar estudo do conteúdo"]') as HTMLButtonElement).click());
  if (process.env.COMPETITOR_PREVIEW_HTML) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      process.env.COMPETITOR_PREVIEW_HTML,
      `<!doctype html><html lang="pt-BR" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/preview.css"></head><body style="padding:24px;max-width:1300px;margin:auto"><p style="padding:12px;color:#a78bfa">PRÉVIA DE TESTE — DADOS SIMULADOS</p><main class="marketing-shell rounded-3xl border p-3">${host.innerHTML}</main></body></html>`,
    );
  }
  const select=host.querySelector<HTMLButtonElement>('[aria-label="Analisar @perfil_teste"]')!;
  await act(async()=>select.click());
  expect(host.textContent).toContain("Analisando @perfil_teste");
  expect(host.querySelector('.radar-profile.is-selected')).not.toBeNull();
  expect(host.textContent).toContain("1.200");
  expect(host.textContent).toContain("Pausar coleta");
  expect(host.textContent).toContain("Histórico de coletas");
  expect(host.querySelector('[aria-label="Visões de concorrentes"]')).toBeNull();
});

it("keeps registration and first collection explicit and preserves the new profile on collection failure",async()=>{
 const newProfile={id:"new",username:"perfil_novo",name:null,active:true,followers_count:null,last_sync_at:null,next_sync_at:new Date(Date.now()+86400000).toISOString(),sync_error:"Perfil indisponível",partial:true};let added=false;
 const fetcher=vi.fn(async(_url,options)=>{if(options?.method==="POST"){added=true;return Response.json({success:true,profile:{id:"new",username:"perfil_novo"},collection:{success:false,error:"Perfil indisponível"}},{status:201});}return Response.json({...empty,configured:true,profiles:added?[newProfile]:[]});});vi.stubGlobal("fetch",fetcher);
 await act(async()=>root.render(createElement(Page)));const add=Array.from(host.querySelectorAll("button")).find(b=>b.textContent?.includes("Adicionar primeiro concorrente"))!;await act(async()=>add.click());
 const input=document.querySelector<HTMLInputElement>('#competitor-username')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"https://www.instagram.com/perfil_novo/");input.dispatchEvent(new Event("input",{bubbles:true}));});
 expect(document.body.textContent).toContain("@perfil_novo");const submit=document.querySelector<HTMLButtonElement>('.radar-add-dialog button[type=submit]')!;expect(submit.textContent).toContain("Adicionar e coletar");await act(async()=>submit.click());
 const call=fetcher.mock.calls.find(c=>c[1]?.method==="POST")!;expect(JSON.parse(call[1].body)).toMatchObject({action:"add",collect:true,username:"https://www.instagram.com/perfil_novo/"});expect(host.textContent).toContain("Perfil cadastrado. Perfil indisponível");expect(host.textContent).toContain("Analisando @perfil_novo");expect(host.querySelector<HTMLButtonElement>('.radar-collect')?.disabled).toBe(true);
});
