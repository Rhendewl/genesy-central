"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  SubmissionListItem, SubmissionStats, SubmissionsListResponse,
  RespostasParams, SubmissionPatch,
} from "@/lib/respostas/types";

const EMPTY_STATS: SubmissionStats = {
  total: 0, completed: 0, abandoned: 0, completionRate: 0, avgTimeOnFormMs: 0,
};

function buildUrl(base: string, params: RespostasParams): string {
  const sp = new URLSearchParams();
  if (params.form_id)   sp.set("form_id",   params.form_id);
  if (params.cursor)    sp.set("cursor",    params.cursor);
  if (params.limit)     sp.set("limit",     String(params.limit));
  if (params.q)         sp.set("q",         params.q);
  if (params.status)    sp.set("status",    params.status);
  if (params.sort)      sp.set("sort",      params.sort);
  if (params.direction) sp.set("direction", params.direction);
  if (params.archived !== undefined)  sp.set("archived",  params.archived ? "1" : "0");
  if (params.starred  !== undefined)  sp.set("starred",   params.starred  ? "1" : "0");
  if (params.since)    sp.set("since", params.since);
  if (params.until)    sp.set("until", params.until);
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export interface UseRespostasOptions extends Omit<RespostasParams, "cursor"> {
  enabled?: boolean;
}

export interface UseRespostasReturn {
  submissions:   SubmissionListItem[];
  stats:         SubmissionStats;
  isLoading:     boolean;
  isFetching:    boolean;   // true only during loadMore, not initial load
  error:         string | null;
  hasMore:       boolean;
  loadMore:      () => void;
  refresh:       () => void;
  markRead:      (id: string) => Promise<boolean>;
  toggleStarred: (id: string, starred: boolean) => Promise<boolean>;
  archive:       (id: string) => Promise<boolean>;
  deleteMany:    (ids: string[]) => Promise<boolean>;
}

export function useRespostas(opts: UseRespostasOptions = {}): UseRespostasReturn {
  const { enabled = true, ...params } = opts;

  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [stats,       setStats]       = useState<SubmissionStats>(EMPTY_STATS);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isFetching,  setIsFetching]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [cursor,      setCursor]      = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [rev,         setRev]         = useState(0);

  const paramsRef = useRef(params);
  paramsRef.current = params;

  // ── Initial load / refresh ────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    // Reset pagination state immediately so loadMore can't fire with a stale cursor
    setIsLoading(true);
    setCursor(null);
    setHasMore(false);

    fetch(buildUrl("/api/respostas", paramsRef.current))
      .then(r => r.json())
      .then((res: SubmissionsListResponse) => {
        if (cancelled) return;
        setSubmissions(res.items ?? []);
        setStats(res.stats ?? EMPTY_STATS);
        setCursor(res.nextCursor);
        setHasMore(res.nextCursor !== null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar respostas");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rev,
    // Serialize params (excl. cursor) to detect filter/sort changes without deep equality
    JSON.stringify({ ...params, cursor: undefined }),
  ]);

  // ── Load next page ────────────────────────────────────────────────────────────

  const loadMore = useCallback(() => {
    if (!cursor || !hasMore || isFetching) return;
    setIsFetching(true);
    setError(null);

    fetch(buildUrl("/api/respostas", { ...paramsRef.current, cursor }))
      .then(r => r.json())
      .then((res: SubmissionsListResponse) => {
        setSubmissions(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newItems = (res.items ?? []).filter(s => !existingIds.has(s.id));
          return [...prev, ...newItems];
        });
        setCursor(res.nextCursor);
        setHasMore(res.nextCursor !== null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar mais");
      })
      .finally(() => setIsFetching(false));
  }, [cursor, hasMore, isFetching]);

  const refresh = useCallback(() => setRev(r => r + 1), []);

  // ── Optimistic patch ──────────────────────────────────────────────────────────

  const patch = useCallback(async (
    id: string,
    updates: SubmissionPatch,
    optimistic: Partial<SubmissionListItem>,
  ): Promise<boolean> => {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...optimistic } : s));

    try {
      const res = await fetch(`/api/respostas/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(await res.text());
      const { submission } = await res.json() as { submission: SubmissionListItem };
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...submission } : s));
      return true;
    } catch {
      // Roll back by re-fetching page 1
      setRev(r => r + 1);
      return false;
    }
  }, []);

  const markRead = useCallback((id: string) => {
    const now = new Date().toISOString();
    return patch(id, { read_at: now }, { read_at: now });
  }, [patch]);

  const toggleStarred = useCallback((id: string, starred: boolean) => {
    return patch(id, { starred }, { starred });
  }, [patch]);

  const archive = useCallback((id: string) => {
    return patch(id, { archived: true }, { archived: true });
  }, [patch]);

  const deleteMany = useCallback(async (ids: string[]): Promise<boolean> => {
    const prev = [...submissions];
    setSubmissions(s => s.filter(x => !ids.includes(x.id)));
    try {
      const res = await fetch("/api/respostas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    } catch {
      setSubmissions(prev);
      return false;
    }
  }, [submissions]);

  return {
    submissions, stats, isLoading, isFetching, error,
    hasMore, loadMore, refresh, markRead, toggleStarred, archive, deleteMany,
  };
}
