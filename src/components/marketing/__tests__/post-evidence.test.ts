import {act,createElement} from "react";
import {createRoot} from "react-dom/client";
import {expect,it} from "vitest";
import {PostEvidence} from "../PostEvidence";
import {postEvidence,type RankedPost} from "@/lib/marketing/competitor-evidence";
it("emphasizes real values and exposes the basis of the recommendation beside missing metrics",async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 const posts=[10,20,30,40,100].map((comments,i)=>({id:String(i),profile_id:"a",media_type:"IMAGE",comments_count:comments,like_count:null,interactions:null,score:null,sample:0,baseline:null}) as RankedPost);const p=posts[4];
 await act(async()=>root.render(createElement(PostEvidence,{post:p,evidence:postEvidence(p,posts,10000)})));
 expect(host.querySelector(".ci-number-comments strong")?.textContent).toBe("100");expect(host.querySelector(".ci-number-likes strong")?.textContent).toBe("N/D");expect(host.querySelector(".ci-number-engagement strong")?.textContent).toBe("N/D");
 expect(host.textContent).toContain("2,5×");expect(host.textContent).toContain("+150% acima");expect(host.textContent).toContain("1º de 5");expect(host.textContent).toContain("Estudar primeiro");expect(host.textContent).toContain("Comparação só de comentários");
 await act(async()=>root.unmount());host.remove();
});
