import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it} from "vitest";
import {CompetitorGallery} from "../CompetitorGallery";
import type {rankPosts} from "@/lib/marketing/competitor-domain";
let host:HTMLDivElement,root:Root;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const base={profile_id:"a",media_type:"IMAGE",caption:"Primeiro gancho",permalink:"https://www.instagram.com/p/abc/",published_at:"2026-11-01T12:00:00Z",collected_at:"2026-11-04T12:00:00Z",like_count:90,comments_count:10,interactions:100,baseline:50,sample:5,score:2};
const posts=[{...base,id:"one"},{...base,id:"two",media_type:"VIDEO",caption:"Vídeo abaixo",score:0.5},{...base,id:"three",caption:"Oculto",comments_count:800,like_count:null,interactions:null,score:null}] as ReturnType<typeof rankPosts>;
const profiles=[{id:"a",username:"exemplo",active:true}];
const button=(text:string)=>Array.from(host.querySelectorAll("button")).find(b=>b.textContent?.trim()===text)!;
it("shows comparable winners, filters formats and excludes incomplete posts from above-average results",async()=>{
 await act(async()=>root.render(createElement(CompetitorGallery,{posts,profiles,truncated:false})));
 if(process.env.COMPETITOR_UX_PREVIEW_HTML){const {writeFileSync}=await import("node:fs");writeFileSync(process.env.COMPETITOR_UX_PREVIEW_HTML,`<!doctype html><html lang="pt-BR" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/preview.css"><link rel="stylesheet" href="/competitors.css"></head><body style="padding:24px;max-width:1280px;margin:auto"><p style="padding:10px;color:#a5a2ff;font-size:11px">PRÉVIA DE TESTE · DADOS SIMULADOS</p>${host.innerHTML}</body></html>`);}
 expect(host.querySelectorAll("article")).toHaveLength(3);expect(host.querySelectorAll(".ci-rank")).toHaveLength(2);
 await act(async()=>button("Só acima da média").click());expect(host.querySelectorAll("article")).toHaveLength(1);expect(host.querySelector("article")?.textContent).toContain("Primeiro gancho");
 await act(async()=>button("Vídeos").click());expect(host.textContent).toContain("Nenhum conteúdo com estes filtros");
});
it("uses available comments when no relative comparison can be calculated",async()=>{
 await act(async()=>root.render(createElement(CompetitorGallery,{posts:posts.filter(p=>p.score===null),profiles,truncated:false})));
 expect(host.textContent).toContain("MAIS COMENTÁRIOS NA AMOSTRA");expect(host.textContent).toContain("comparação relativa indisponível");expect(host.querySelector(".ci-rank")).toBeNull();
});
