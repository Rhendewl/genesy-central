"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { NewTag, Tag } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Module-level cache — tags mudam raramente e são usadas em cada LeadCard.
// Evita N fetches paralelos quando o board renderiza muitos cards.
// O cache é invalidado após mutações (create/update/delete).
// ─────────────────────────────────────────────────────────────────────────────
let _cache: Tag[] | null = null;
let _pending: Promise<Tag[]> | null = null;

function invalidateCache() {
  _cache = null;
  _pending = null;
}

export function useTags() {
  const supabase = getSupabaseClient();
  const mountedRef = useRef(true);

  const [tags, setTags] = useState<Tag[]>(_cache ?? []);
  const [isLoading, setIsLoading] = useState(_cache === null);

  // ── Fetch (com cache) ──────────────────────────────────────────────────────

  const fetchTags = useCallback(async () => {
    if (_cache !== null) {
      setTags(_cache);
      setIsLoading(false);
      return;
    }

    if (!_pending) {
      // Supabase retorna PromiseLike — envolvemos em Promise nativa
      // para compatibilidade estrita com TypeScript
      _pending = new Promise<Tag[]>((resolve) => {
        supabase
          .from("tags")
          .select("*")
          .order("name")
          .then(({ data }) => {
            _cache = (data as Tag[]) ?? [];
            resolve(_cache);
          });
      });
    }

    const result = await _pending;
    if (!mountedRef.current) return;
    setTags(result ?? []);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    mountedRef.current = true;
    fetchTags();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchTags]);

  // ── Create ─────────────────────────────────────────────────────────────────

  async function createTag(data: NewTag): Promise<{ error: string | null }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Não autenticado." };

    const { error } = await supabase.from("tags").insert({ ...data, user_id: user.id });
    if (error) return { error: error.message };

    invalidateCache();
    await fetchTags();
    return { error: null };
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async function updateTag(
    id: string,
    data: Partial<NewTag>
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.from("tags").update(data).eq("id", id);
    if (error) return { error: error.message };

    invalidateCache();
    await fetchTags();
    return { error: null };
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deleteTag(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) return { error: error.message };

    invalidateCache();
    await fetchTags();
    return { error: null };
  }

  return {
    tags,
    isLoading,
    createTag,
    updateTag,
    deleteTag,
    refetch: fetchTags,
  };
}
