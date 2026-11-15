"use client";
import {useEffect,useState} from "react";
import {getSupabaseClient} from "@/lib/supabase";
export type LeadActivity={hasNotes:boolean;hasReminder:boolean};
export function useLeadActivityIndicators(leadIds:string[]){
 const key=Array.from(new Set(leadIds)).sort().join(",");
 const [items,setItems]=useState<Record<string,LeadActivity>>({});
 useEffect(()=>{
  let live=true,sequence=0;
  const ids=key?key.split(","):[];
  if(!ids.length){setItems({});return;}
  const load=async()=>{const attempt=++sequence;const next:Record<string,LeadActivity>={};
   try{for(let i=0;i<ids.length;i+=500){const {data,error}=await getSupabaseClient().rpc("crm_lead_activity_indicators",{p_lead_ids:ids.slice(i,i+500)});if(error)return;for(const r of (data??[]) as {lead_id:string;has_notes:boolean;has_reminder:boolean}[])next[r.lead_id]={hasNotes:r.has_notes,hasReminder:r.has_reminder};}if(live&&sequence===attempt)setItems(next);}catch{/* Keep the last confirmed flags during a transient connection failure. */}
  };
  const refresh=()=>void load();void load();
  const timer=setInterval(()=>{if(document.visibilityState==="visible")void load();},30000);
  window.addEventListener("crm-lead-activity-changed",refresh);window.addEventListener("focus",refresh);
  return()=>{live=false;clearInterval(timer);window.removeEventListener("crm-lead-activity-changed",refresh);window.removeEventListener("focus",refresh);};
 },[key]);
 return items;
}
