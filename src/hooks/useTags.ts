"use client";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { NewTag, Tag } from "@/types";
type CatalogResult = {data: Tag[]; error: string | null};
const catalogRequests = new Map<string, Promise<CatalogResult>>();
let sessionUserId: string | null = null;
export function useTags(scope: "global" | "workspace" = "global") {
  const supabase = getSupabaseClient();
  const table = scope === "workspace" ? "workspace_tags" : "tags";
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests] = useState(() => ({version:0}));
  const fetchTags = useCallback(async () => {
    const version = ++requests.version;
    const {data:{session}} = await supabase.auth.getSession();
    const key = `${table}:${session?.user.id ?? 'anonymous'}`;
    let request = catalogRequests.get(key);
    if (!request) {
      request = Promise.resolve(supabase.from(table).select('*').order('name')).then(({data,error})=>({data: error ? [] : (data ?? []) as Tag[],error:error?.message ?? null}));
      catalogRequests.set(key,request);
    }
    try {
      const result = await request;
      if (version!==requests.version) return;
      setTags(result.data);setError(result.error);setLoading(false);
      if(result.error) catalogRequests.delete(key);
    } catch (error) {
      catalogRequests.delete(key);
      if(version===requests.version){setError(error instanceof Error?error.message:'Erro ao carregar etiquetas');setLoading(false);}
    }
  },[supabase,table,requests]);
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
    const { data: tag, error } = await supabase
      .from(table)
      .insert({ ...data, name: data.name.trim(), user_id: user.id })
      .select("*")
      .single();
    if (!error) changed();
    return { tag: tag as Tag | null, error: error?.message ?? null };
  }
  async function updateTag(id: string, data: Partial<NewTag>) {
    const { error } = await supabase
      .from(table)
      .update(data)
      .eq("id", id)
      .select("id")
      .single();
    if (!error) changed();
    return { error: error?.message ?? null };
  }
  async function deleteTag(id: string) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .select("id")
      .single();
    if (!error) changed();
    return { error: error?.message ?? null };
  }
  return {
    tags,
    isLoading,
    error,
    createTag,
    updateTag,
    deleteTag,
    refetch: fetchTags,
  };
}
