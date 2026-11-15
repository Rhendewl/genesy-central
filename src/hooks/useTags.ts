"use client";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { NewTag, Tag } from "@/types";
type CatalogResult = {data: Tag[]; error: string | null};
const catalogRequests = new Map<string, Promise<CatalogResult>>();
let sessionUserId: string | null = null;
export function useTags(scope: "global" | "workspace" | "crm" = "global", pipelineId?: string | null) {
  if (scope === "crm" && process.env.NEXT_PUBLIC_CRM_PIPELINE_TAGS_ENABLED !== "true") scope = "global";
  const supabase = getSupabaseClient();
  const table = scope === "crm" ? "crm_pipeline_tags" : scope === "workspace" ? "workspace_tags" : "tags";
  const catalogScope = `${table}:${scope === "crm" ? pipelineId ?? "none" : "all"}`;
  const [loadedScope, setLoadedScope] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests] = useState(() => ({version:0}));
  const fetchTags = useCallback(async () => {
    const version = ++requests.version;
    if (scope === "crm" && !pipelineId) { setTags([]); setError(null); setLoading(false); setLoadedScope(catalogScope); return; }
    const {data:{session}} = await supabase.auth.getSession();
    const key = `${catalogScope}:${session?.user.id ?? 'anonymous'}`;
    let request = catalogRequests.get(key);
    if (!request) {
      let query = supabase.from(table).select('*').order('name');
      if (scope === 'crm') query = query.eq('pipeline_id', pipelineId!);
      request = Promise.resolve(query).then(({data,error})=>({data: error ? [] : (data ?? []) as Tag[],error:error?.message ?? null}));
      catalogRequests.set(key,request);
    }
    try {
      const result = await request;
      if (version!==requests.version) return;
      setLoadedScope(catalogScope);setTags(result.data);setError(result.error);setLoading(false);
      if(result.error) catalogRequests.delete(key);
    } catch (error) {
      catalogRequests.delete(key);
      if(version===requests.version){setLoadedScope(catalogScope);setError(error instanceof Error?error.message:'Erro ao carregar etiquetas');setLoading(false);}
    }
  },[supabase,table,requests,scope,pipelineId,catalogScope]);
  useEffect(()=>{
    void fetchTags();
    const refresh=()=>{void fetchTags();};
    window.addEventListener(`${table}-changed`,refresh);
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      const nextId=session?.user.id ?? null;
      if(nextId!==sessionUserId){catalogRequests.clear();sessionUserId=nextId;}
      requests.version++;setTags([]);setTimeout(refresh,0);
    });
    return ()=>{requests.version++;window.removeEventListener(`${table}-changed`,refresh);subscription.unsubscribe();};
  },[fetchTags,supabase,table,requests]);
  function changed(){
    for(const key of Array.from(catalogRequests.keys())) if(key.startsWith(`${table}:`)) catalogRequests.delete(key);
    window.dispatchEvent(new Event(`${table}-changed`));
  }
  async function createTag(data: NewTag) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { tag: null, error: "Não autenticado" };
    if (scope === "crm" && !pipelineId) return { tag: null, error: "Selecione uma pipeline para criar etiquetas." };
    const { data: tag, error } = await supabase
      .from(table)
      .insert({ ...data, name: data.name.trim(), ...(scope === "crm" ? { pipeline_id: pipelineId } : { user_id: user.id }) })
      .select("*")
      .single();
    if (!error) changed();
    return { tag: tag as Tag | null, error: error?.message ?? null };
  }
  async function updateTag(id: string, data: Partial<NewTag>) {
    if (scope === "crm" && !pipelineId) return { error: "Pipeline não selecionada." };
    let query = supabase.from(table).update(data).eq("id", id);
    if (scope === "crm") query = query.eq("pipeline_id", pipelineId!);
    const { error } = await query.select("id").single();
    if (!error) changed();
    return { error: error?.message ?? null };
  }
  async function deleteTag(id: string) {
    if (scope === "crm" && !pipelineId) return { error: "Pipeline não selecionada." };
    let query = supabase.from(table).delete().eq("id", id);
    if (scope === "crm") query = query.eq("pipeline_id", pipelineId!);
    const { error } = await query.select("id").single();
    if (!error) changed();
    return { error: error?.message ?? null };
  }
  return {
    tags: loadedScope === catalogScope ? tags : [],
    isLoading: isLoading || loadedScope !== catalogScope,
    error: loadedScope === catalogScope ? error : null,
    createTag,
    updateTag,
    deleteTag,
    refetch: fetchTags,
  };
}
