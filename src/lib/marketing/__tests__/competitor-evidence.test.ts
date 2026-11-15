import {expect,it} from "vitest";
import {postEvidence,type RankedPost} from "../competitor-evidence";
const post=(id:string,comments:number|null,profile="a",format="IMAGE"):RankedPost=>({id,profile_id:profile,media_type:format,caption:"Gancho",permalink:null,published_at:"2026-11-04",collected_at:"2026-11-04",like_count:null,comments_count:comments,interactions:null,baseline:null,sample:0,score:null});
it("compares available comments in the same profile and format without inventing engagement",()=>{
 const winner=post("5",100);const posts=[post("1",10),post("2",20),post("3",30),post("4",40),winner,post("6",null),post("foreign",10000,"other"),post("video",10000,"a","VIDEO")];
 const e=postEvidence(winner,posts,120000);expect(e).toMatchObject({basis:"comments",baseline:40,ratio:2.5,delta:150,sample:5,rank:1,level:"high",engagement:null});
});
it("calculates engagement only from complete interactions and a positive follower count",()=>{
 const p={...post("a",10),like_count:90,interactions:100,score:2,sample:5,baseline:50};expect(postEvidence(p,[p],1000).engagement).toBe(10);
 for(const followers of [0,null,undefined])expect(postEvidence(p,[p],followers).engagement).toBeNull();
 expect(postEvidence({...p,like_count:0,comments_count:0,interactions:0},[p],1000).engagement).toBe(0);
});
it("does not assign a priority from a small sample or zero baseline",()=>{
 const small=[post("1",10),post("2",20)];expect(postEvidence(small[0],small)).toMatchObject({ratio:null,level:"unknown",rank:2,sample:2});
 const zeros=Array.from({length:5},(_,i)=>post(String(i),0));expect(postEvidence(zeros[0],zeros)).toMatchObject({ratio:null,rank:1});
});
it("ties share positions and missing comment counts are excluded",()=>{
 const posts=[post("1",100),post("2",100),post("3",20),post("4",10),post("5",0),post("6",null)];expect(postEvidence(posts[0],posts).rank).toBe(1);expect(postEvidence(posts[1],posts).rank).toBe(1);expect(postEvidence(posts[2],posts).rank).toBe(3);expect(postEvidence(posts[5],posts).rank).toBeNull();
});
