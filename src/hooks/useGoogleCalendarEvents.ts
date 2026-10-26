"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import type { NormalizedCalendarEvent, CalendarEventsResponse } from "@/types/google-calendar";

const CACHE_FRESH_MS = 30_000;   // mantém a navegação instantânea entre telas
const CACHE_STALE_MS = 5_000;    // ao voltar para a aba, atualiza quase imediatamente
const POLL_INTERVAL_MS = 30_000; // consulta frequente somente com a página visível

interface CacheEntry {
  events:    NormalizedCalendarEvent[];
  connected: boolean;
  fetchedAt: number;
}

// Module-level cache — persists across mounts/period navigation within the session.
const cache = new Map<string, CacheEntry>();

export function invalidateGoogleCalendarEvents() {
  cache.clear();
  window.dispatchEvent(new Event("google-calendar:changed"));
}

export function useGoogleCalendarEvents(rangeStart: Date, rangeEnd: Date) {
  const fromKey = format(rangeStart, "yyyy-MM-dd");
  const toKey   = format(rangeEnd,   "yyyy-MM-dd");
  const cacheKey = `${fromKey}_${toKey}`;

  const initialEntry = cache.get(cacheKey);
  const [events,    setEvents]    = useState<NormalizedCalendarEvent[]>(initialEntry?.events ?? []);
  const [connected, setConnected] = useState<boolean>(initialEntry?.connected ?? true);
  const [isLoading, setIsLoading] = useState<boolean>(!initialEntry);
  const [error,     setError]     = useState<string | null>(null);

  const mountedRef      = useRef(true);
  const abortRef        = useRef<AbortController | null>(null);

  const fetchRange = useCallback(async (from: string, to: string, opts?: { silent?: boolean }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!opts?.silent) setIsLoading(true);
    setError(null);

    try {
      // Use the viewer's local day boundaries, including evenings on the last day.
      const timeMin = new Date(`${from}T00:00:00`).toISOString();
      const timeMax = addDays(new Date(`${to}T00:00:00`), 1).toISOString();
      const params = new URLSearchParams({ from: timeMin, to: timeMax, refresh: String(Date.now()) });
      const res  = await fetch(`/api/google-calendar/events?${params.toString()}`, {
        signal: controller.signal,
        cache:  "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const json = await res.json() as CalendarEventsResponse;
      if (!mountedRef.current || controller.signal.aborted) return;

      if (!res.ok && json.error) throw new Error(json.error);

      cache.set(`${from}_${to}`, { events: json.events, connected: json.connected, fetchedAt: Date.now() });

      setEvents(json.events);
      setConnected(json.connected);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar agenda");
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => fetchRange(fromKey, toKey), [fetchRange, fromKey, toKey]);

  useEffect(() => {
    mountedRef.current = true;

    const entry = cache.get(cacheKey);
    const age   = entry ? Date.now() - entry.fetchedAt : Infinity;

    if (entry && age < CACHE_FRESH_MS) {
      setEvents(entry.events);
      setConnected(entry.connected);
      setIsLoading(false);
      if (age > CACHE_STALE_MS) void fetchRange(fromKey, toKey, { silent: true });
    } else {
      void fetchRange(fromKey, toKey);
    }

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // Refresh on window focus / tab visibility — best-effort "auto update"
  // since Google Calendar events aren't backed by Supabase Realtime.
  useEffect(() => {
    const onFocusOrVisible = () => {
      if (document.visibilityState !== "visible") return;
      const entry = cache.get(cacheKey);
      const age   = entry ? Date.now() - entry.fetchedAt : Infinity;
      if (age > CACHE_STALE_MS) void fetchRange(fromKey, toKey, { silent: true });
    };

    const onCalendarChanged = () => { void fetchRange(fromKey, toKey, { silent: true }); };
    window.addEventListener("google-calendar:changed", onCalendarChanged);
    window.addEventListener("focus", onFocusOrVisible);
    window.addEventListener("online", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);
    const interval = setInterval(onFocusOrVisible, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("google-calendar:changed", onCalendarChanged);
      window.removeEventListener("focus", onFocusOrVisible);
      window.removeEventListener("online", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
      clearInterval(interval);
    };
  }, [cacheKey, fetchRange, fromKey, toKey]);

  return { events, connected, isLoading, error, refetch };
}
