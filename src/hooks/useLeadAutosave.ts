"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DraftAutosaver, type SaveStatus } from "@/lib/crm/draft-autosaver";
import type { UpdateLead } from "@/types";

export function useLeadAutosave(key: string | null, initial: UpdateLead, value: UpdateLead, valid: boolean,
  persist: (id: string, patch: UpdateLead) => Promise<{error: string | null}>) {
  const persistRef = useRef(persist);
  const valueRef = useRef({value, valid});
  persistRef.current = persist;
  valueRef.current = {value, valid};
  const [status, setStatus] = useState<SaveStatus>("saved");
  const saver = useMemo(() => key ? new DraftAutosaver(initial, patch => persistRef.current(key, patch)) : null,
    // Initial data belongs to the opening session, not to realtime updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  useEffect(() => {
    setStatus(saver?.status ?? "saved");
    const unsubscribe = saver?.subscribe(setStatus);
    return () => { unsubscribe?.(); saver?.cancelTimer(); };
  }, [saver]);
  useEffect(() => { saver?.update(value, valid); }, [saver, value, valid]);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (saver?.dirty || saver?.status === "saving") { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saver]);
  const flush = useCallback(async () => {
    if (!saver) return true;
    saver.update(valueRef.current.value, valueRef.current.valid);
    return saver.flush();
  }, [saver]);
  return {status, flush};
}
