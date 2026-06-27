"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { Form, FormStep } from "@/types";
import { createLogicEngine, adaptLegacyRule } from "@/lib/logic-engine";
import type { EventBus } from "@/lib/event-bus";
import { createEventBus, generateId } from "@/lib/event-bus";
import { FORM_SOURCE, createFormAnalyticsConsumer, type FormEventType } from "@/lib/event-bus/form";

// ── Screen states ─────────────────────────────────────────────────────────────

export type RendererScreen =
  | "loading"     // initial fetch
  | "not_found"   // form doesn't exist or is unpublished
  | "welcome"     // welcome screen
  | "step"        // a form step
  | "ending"      // navigation reached the end — submission not yet triggered
  | "submitting"  // submission in flight
  | "submitted"   // submission succeeded
  | "error";      // submission failed after all retries

// ── localStorage ──────────────────────────────────────────────────────────────

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface StoredSession {
  token: string;
  answers: Record<string, unknown>;
  currentStepIndex: number;
  startedAt: number;
  lastActivityAt: number;
  correlationId?: string; // may be absent in sessions created before this field was added
}

function readStorage(key: string): StoredSession | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (Date.now() - parsed.lastActivityAt > SESSION_TIMEOUT_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(key: string, data: StoredSession): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch { /* QuotaExceeded — ignore */ }
}

function clearStorage(key: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {}
}

// ── Return type ───────────────────────────────────────────────────────────────

export interface UseFormularioRendererReturn {
  form: Form | null;
  screen: RendererScreen;
  currentStepIndex: number;
  currentStep: FormStep | null;
  answers: Record<string, unknown>;
  endingId: string | null;
  isOnline: boolean;
  canGoBack: boolean;
  setAnswer: (stepId: string, value: unknown) => void;
  goNext: () => void;
  goBack: () => void;
  startForm: () => void;
  submitForm: () => Promise<void>;
  retrySubmit: () => void;
  restart: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFormularioRenderer(slug: string): UseFormularioRendererReturn {
  const storageKey = `genesy_form_${slug}`;

  const [form,              setForm]             = useState<Form | null>(null);
  const [screen,            setScreen]           = useState<RendererScreen>("loading");
  const [currentStepIndex,  setCurrentStepIndex] = useState(0);
  const [answers,           setAnswers]          = useState<Record<string, unknown>>({});
  const [endingId,          setEndingId]         = useState<string | null>(null);
  const [isOnline,          setIsOnline]         = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  // ── Refs for stable closures ───────────────────────────────────────────────
  const sessionTokenRef      = useRef<string | null>(null);
  const startTimeRef         = useRef<number>(Date.now());
  const hasSubmittedRef      = useRef(false);
  const isCreatingSessionRef = useRef(false);
  const answersRef           = useRef(answers);
  const screenRef            = useRef<RendererScreen>("loading");
  const currentStepIdxRef    = useRef(0);

  // Event Bus ref — created in load effect (before any await) and stable across renders
  const busRef           = useRef<EventBus<FormEventType> | null>(null);
  const correlationIdRef = useRef<string>(generateId()); // restored from storage when available

  useEffect(() => { answersRef.current        = answers;          });
  useEffect(() => { screenRef.current         = screen;           });
  useEffect(() => { currentStepIdxRef.current = currentStepIndex; }, [currentStepIndex]);

  // ── Bus cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      busRef.current?.destroy();
      busRef.current = null;
    };
  }, []);

  // ── Persist to localStorage after every relevant change ───────────────────
  useEffect(() => {
    if (!sessionTokenRef.current) return;
    writeStorage(storageKey, {
      token:            sessionTokenRef.current,
      answers,
      currentStepIndex,
      startedAt:        startTimeRef.current,
      lastActivityAt:   Date.now(),
      correlationId:    correlationIdRef.current,
    });
  }, [answers, currentStepIndex, storageKey]);

  // ── Online / offline detection ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ── Flush CRITICAL events when connection is restored ─────────────────────
  useEffect(() => {
    if (isOnline) {
      busRef.current?.flush().catch(() => {});
    }
  }, [isOnline]);

  // ── Session creation (idempotent, concurrent-safe) ────────────────────────
  const ensureSession = useCallback(async () => {
    if (sessionTokenRef.current)      return;
    if (isCreatingSessionRef.current) return;
    isCreatingSessionRef.current = true;

    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    const body = {
      device:       getDevice(),
      browser:      getBrowser(),
      os:           getOS(),
      utm_source:   params.get("utm_source")   ?? undefined,
      utm_medium:   params.get("utm_medium")   ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined,
      utm_term:     params.get("utm_term")     ?? undefined,
      utm_content:  params.get("utm_content")  ?? undefined,
      fbclid:       params.get("fbclid")       ?? undefined,
      gclid:        params.get("gclid")        ?? undefined,
      referrer:     typeof document !== "undefined" ? document.referrer || undefined : undefined,
    };

    try {
      const res = await fetch(`/api/form/${slug}/sessao`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      }).catch(() => null);

      if (res?.ok) {
        const json = await res.json() as { token: string };
        sessionTokenRef.current = json.token;
        startTimeRef.current    = Date.now();
      }

      // form.started → analytics consumer maps to "session_started" in DB
      busRef.current?.publish("form.started", { formSlug: slug });
    } finally {
      isCreatingSessionRef.current = false;
    }
  }, [slug]);

  // ── Load form + create bus ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/form/${slug}`)
      .then(r => r.json())
      .then(async (json) => {
        if (!json.formulario) { setScreen("not_found"); return; }
        const loadedForm = json.formulario as Form;
        setForm(loadedForm);

        // Restore correlationId from previous session (or use the generated one)
        const stored = readStorage(storageKey);
        if (stored?.correlationId) {
          correlationIdRef.current = stored.correlationId;
        }

        // Create bus immediately (sync) — before any await so it's available
        // in all subsequent ensureSession, startForm, goNext, etc. calls
        busRef.current = createEventBus<FormEventType>({
          source:        FORM_SOURCE,
          correlationId: correlationIdRef.current,
          consumers:     [createFormAnalyticsConsumer(slug, () => sessionTokenRef.current)],
          debug:         process.env.NODE_ENV === "development",
        });

        busRef.current.publish("form.loaded", {
          formSlug:   slug,
          hasWelcome: !!loadedForm.welcome_screen?.enabled,
          stepCount:  loadedForm.steps.length,
        });

        if (stored) {
          sessionTokenRef.current = stored.token;
          startTimeRef.current    = stored.startedAt;
          setAnswers(stored.answers);
          setCurrentStepIndex(stored.currentStepIndex);
          setScreen("step");
          busRef.current.publish("form.resumed", {
            formSlug:           slug,
            restoredStepIndex:  stored.currentStepIndex,
            answersCount:       Object.keys(stored.answers).length,
          });
          return;
        }

        if (!loadedForm.welcome_screen?.enabled) {
          setScreen("step");
          await ensureSession();
        } else {
          setScreen("welcome");
          busRef.current.publish("form.welcome.viewed", { formSlug: slug });
        }
      })
      .catch(() => setScreen("not_found"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ── Logic engine ───────────────────────────────────────────────────────────
  const engine = useMemo(() => {
    if (!form) return null;
    const rules = (form.logic_rules ?? []).map(adaptLegacyRule);
    return createLogicEngine({
      steps:   form.steps.map(s => ({ id: s.id, type: s.type, required: s.required ?? false })),
      rules,
      endings: form.endings?.map(e => ({ id: e.id })),
    });
  }, [form]);

  // ── startForm — called by welcome screen CTA ───────────────────────────────
  const startForm = useCallback(async () => {
    await ensureSession();
    setScreen("step");
    setCurrentStepIndex(0);
  }, [ensureSession]);

  // ── Partial save on abandonment ────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleUnload = () => {
      const token = sessionTokenRef.current;
      if (!token || screenRef.current === "submitted") return;

      // Best-effort: publish abandoned event (may not complete before unload)
      busRef.current?.publish("form.abandoned", {
        formSlug:      slug,
        lastStepIndex: currentStepIdxRef.current,
        answersCount:  Object.keys(answersRef.current).length,
      });

      // Guaranteed delivery via sendBeacon for partial save
      const payload = JSON.stringify({
        session_token: token,
        answers:       answersRef.current,
        status:        "partial",
      });
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          `/api/form/${slug}/resposta`,
          new Blob([payload], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [slug]);

  // ── Browser back button: navigate within form ──────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.pushState({ formNav: true }, "");

    const handlePopState = (e: PopStateEvent) => {
      if (!e.state?.formNav) return;
      const currentScreen = screenRef.current;
      const stepIdx       = currentStepIdxRef.current;

      if (currentScreen === "step" && stepIdx > 0) {
        setCurrentStepIndex(prev => prev - 1);
        window.history.pushState({ formNav: true }, "");
      } else if (currentScreen === "step" && stepIdx === 0) {
        // At first step — allow natural back navigation (leave form)
      } else {
        window.history.pushState({ formNav: true }, "");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // ── Tab visibility — update lastActivityAt when user returns ───────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && sessionTokenRef.current) {
        writeStorage(storageKey, {
          token:            sessionTokenRef.current,
          answers:          answersRef.current,
          currentStepIndex: currentStepIdxRef.current,
          startedAt:        startTimeRef.current,
          lastActivityAt:   Date.now(),
          correlationId:    correlationIdRef.current,
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [storageKey]);

  // ── setAnswer ──────────────────────────────────────────────────────────────
  const setAnswer = useCallback((stepId: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [stepId]: value }));
  }, []);

  // ── goNext ─────────────────────────────────────────────────────────────────
  // Uses answersRef (not answers state) so this callback is stable — avoids
  // re-rendering all children on every answer change.
  // Non-async: bus.publish() is fire-and-forget, no awaits needed.
  const goNext = useCallback(() => {
    if (!form) return;
    const step = form.steps[currentStepIndex];
    if (!step) return;

    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    busRef.current?.publish("form.step.completed", {
      formSlug:        slug,
      stepId:          step.id,
      durationSeconds,
    });

    const result = engine?.evaluate({ currentStepId: step.id, answers: answersRef.current });

    switch (result?.type) {
      case "next_step": {
        const idx = form.steps.findIndex(s => s.id === result.stepId);
        if (idx >= 0) {
          setCurrentStepIndex(idx);
          busRef.current?.publish("form.step.viewed", {
            formSlug:  slug,
            stepId:    form.steps[idx].id,
            stepIndex: idx,
            stepType:  form.steps[idx].type,
          });
          return;
        }
        break; // target not found — fall through to sequential
      }
      case "ending": {
        busRef.current?.publish("form.completed", {
          formSlug:   slug,
          totalSteps: form.steps.length,
          endingId:   result.endingId,
        });
        setEndingId(result.endingId);
        setScreen("ending");
        return;
      }
      case "redirect": {
        busRef.current?.publish("form.redirect", { formSlug: slug, url: result.url });
        if (typeof window !== "undefined") window.location.href = result.url;
        return;
      }
      case "complete": {
        const defaultEndingId = form.endings?.[0]?.id ?? null;
        busRef.current?.publish("form.completed", {
          formSlug:   slug,
          totalSteps: form.steps.length,
          endingId:   defaultEndingId ?? undefined,
        });
        setEndingId(defaultEndingId);
        setScreen("ending");
        return;
      }
      default:
        break;
    }

    // Sequential navigation
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= form.steps.length) {
      const defaultEndingId = form.endings?.[0]?.id ?? null;
      busRef.current?.publish("form.completed", {
        formSlug:   slug,
        totalSteps: form.steps.length,
        endingId:   defaultEndingId ?? undefined,
      });
      setEndingId(defaultEndingId);
      setScreen("ending");
    } else {
      setCurrentStepIndex(nextIndex);
      busRef.current?.publish("form.step.viewed", {
        formSlug:  slug,
        stepId:    form.steps[nextIndex].id,
        stepIndex: nextIndex,
        stepType:  form.steps[nextIndex].type,
      });
    }
  }, [form, currentStepIndex, engine, slug]);

  // ── goBack ─────────────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (currentStepIndex === 0) return;
    const prev = currentStepIndex - 1;
    setCurrentStepIndex(prev);
    busRef.current?.publish("form.step.back", {
      formSlug:     slug,
      fromStepId:   form?.steps[currentStepIndex]?.id,
      toStepIndex:  prev,
    });
  }, [currentStepIndex, form, slug]);

  // ── submitForm — with retry and deduplication ──────────────────────────────
  const submitForm = useCallback(async () => {
    if (hasSubmittedRef.current) return;

    if (!sessionTokenRef.current) {
      await ensureSession();
      if (!sessionTokenRef.current) { setScreen("error"); return; }
    }

    if (!isOnline) { setScreen("error"); return; }

    hasSubmittedRef.current = true;
    setScreen("submitting");

    busRef.current?.publish("form.submission.started", { formSlug: slug });

    const MAX_ATTEMPTS = 3;
    let success = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        busRef.current?.publish("form.submission.retry", { formSlug: slug, attempt });
      }

      const res = await fetch(`/api/form/${slug}/resposta`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          session_token: sessionTokenRef.current,
          answers:       answersRef.current,
          status:        "completed",
        }),
      }).catch(() => null);

      if (res?.ok) {
        const json = await res.json().catch(() => ({})) as { submission_id?: string };
        busRef.current?.publish("form.submission.succeeded", {
          formSlug:     slug,
          submissionId: json.submission_id,
        });
        success = true;
        break;
      }

      const shouldRetry = (!res || res.status >= 500) && attempt < MAX_ATTEMPTS;
      if (!shouldRetry) break;

      await new Promise<void>(r => setTimeout(r, 1000 * attempt));
    }

    if (success) {
      clearStorage(storageKey);
      setScreen("submitted");
    } else {
      busRef.current?.publish("form.submission.failed", {
        formSlug: slug,
        reason:   "max_retries_exceeded",
      });
      hasSubmittedRef.current = false;
      setScreen("error");
    }
  }, [slug, isOnline, storageKey, ensureSession]);

  // ── retrySubmit — manual retry after error ─────────────────────────────────
  const retrySubmit = useCallback(() => {
    hasSubmittedRef.current = false;
    void submitForm();
  }, [submitForm]);

  // ── Auto-retry when connection is restored ─────────────────────────────────
  useEffect(() => {
    if (isOnline && screenRef.current === "error") {
      retrySubmit();
    }
  }, [isOnline, retrySubmit]);

  // ── restart ────────────────────────────────────────────────────────────────
  const restart = useCallback(async () => {
    busRef.current?.publish("form.restarted", { formSlug: slug });
    clearStorage(storageKey);
    sessionTokenRef.current      = null;
    hasSubmittedRef.current      = false;
    isCreatingSessionRef.current = false;
    // Generate a new correlationId for the restarted session
    correlationIdRef.current     = generateId();
    setAnswers({});
    setCurrentStepIndex(0);
    setEndingId(null);

    if (form?.welcome_screen?.enabled) {
      setScreen("welcome");
      busRef.current?.publish("form.welcome.viewed", { formSlug: slug });
    } else {
      setScreen("step");
      await ensureSession();
    }
  }, [form, ensureSession, storageKey, slug]);

  const currentStep = form?.steps?.[currentStepIndex] ?? null;
  const canGoBack   = screen === "step" && currentStepIndex > 0;

  return {
    form,
    screen,
    currentStepIndex,
    currentStep,
    answers,
    endingId,
    isOnline,
    canGoBack,
    setAnswer,
    goNext,
    goBack,
    startForm,
    submitForm,
    retrySubmit,
    restart,
  };
}

// ── Device detection helpers ───────────────────────────────────────────────────

function getDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  if (/Mobi|Android/i.test(navigator.userAgent)) return "mobile";
  if (/Tablet|iPad/i.test(navigator.userAgent))  return "tablet";
  return "desktop";
}

function getBrowser(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Chrome"))  return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari"))  return "Safari";
  if (ua.includes("Edge"))    return "Edge";
  return "Other";
}

function getOS(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua))        return "Windows";
  if (/Mac OS/i.test(ua))         return "macOS";
  if (/iPhone|iPad/i.test(ua))    return "iOS";
  if (/Android/i.test(ua))        return "Android";
  if (/Linux/i.test(ua))          return "Linux";
  return "Other";
}
