import type { BusEvent } from "../types";

// ── Source ────────────────────────────────────────────────────────────────────

export const FORM_SOURCE = "form" as const;

// ── Event type union ──────────────────────────────────────────────────────────

export type FormEventType =
  // ── Sessão ──────────────────────────────────────────────────────────────
  | "form.loaded"
  | "form.resumed"
  | "form.started"
  | "form.completed"
  | "form.restarted"
  | "form.abandoned"
  | "form.session.timeout"
  | "form.error"
  // ── Welcome ─────────────────────────────────────────────────────────────
  | "form.welcome.viewed"
  | "form.welcome.started"
  // ── Navegação ───────────────────────────────────────────────────────────
  | "form.step.viewed"
  | "form.step.answered"
  | "form.step.completed"
  | "form.step.back"
  | "form.step.skipped"
  | "form.step.validation_error"
  // ── Respostas ────────────────────────────────────────────────────────────
  | "form.answer.changed"
  | "form.answer.cleared"
  | "form.answer.restored"
  // ── Lógica ──────────────────────────────────────────────────────────────
  | "form.rule.matched"
  | "form.rule.not_matched"
  | "form.jump.executed"
  | "form.ending.reached"
  | "form.redirect"
  // ── Submissão ────────────────────────────────────────────────────────────
  | "form.submission.started"
  | "form.submission.retry"
  | "form.submission.succeeded"
  | "form.submission.failed"
  // ── Conectividade ────────────────────────────────────────────────────────
  | "form.offline"
  | "form.online";

// ── Payload map ───────────────────────────────────────────────────────────────

export interface FormEventPayloads {
  // ── Sessão ──────────────────────────────────────────────────────────────
  "form.loaded":                { formSlug: string; hasWelcome: boolean; stepCount: number };
  "form.resumed":               { formSlug: string; restoredStepIndex: number; answersCount: number };
  "form.started":               { formSlug: string };
  "form.completed":             { formSlug: string; totalSteps: number; endingId?: string };
  "form.restarted":             { formSlug: string };
  "form.abandoned":             { formSlug: string; lastStepIndex: number; answersCount: number };
  "form.session.timeout":       { formSlug: string };
  "form.error":                 { formSlug: string; reason: string; context?: string };
  // ── Welcome ─────────────────────────────────────────────────────────────
  "form.welcome.viewed":        { formSlug: string };
  "form.welcome.started":       { formSlug: string };
  // ── Navegação ───────────────────────────────────────────────────────────
  "form.step.viewed":           { formSlug: string; stepId: string; stepIndex: number; stepType: string };
  "form.step.answered":         { formSlug: string; stepId: string; stepType: string };
  "form.step.completed":        { formSlug: string; stepId: string; stepIndex: number; durationSeconds: number };
  "form.step.back":             { formSlug: string; fromStepId?: string; toStepIndex: number };
  "form.step.skipped":          { formSlug: string; stepId: string; stepIndex: number };
  "form.step.validation_error": { formSlug: string; stepId: string; errorCode?: string };
  // ── Respostas ────────────────────────────────────────────────────────────
  "form.answer.changed":        { formSlug: string; stepId: string; stepType: string };
  "form.answer.cleared":        { formSlug: string; stepId: string };
  "form.answer.restored":       { formSlug: string; stepId: string };
  // ── Lógica ──────────────────────────────────────────────────────────────
  "form.rule.matched":          { formSlug: string; ruleId: string; stepId: string; actionType: string };
  "form.rule.not_matched":      { formSlug: string; stepId: string; rulesChecked: number };
  "form.jump.executed":         { formSlug: string; fromStepId: string; toStepId: string; ruleId: string };
  "form.ending.reached":        { formSlug: string; endingId: string; ruleId?: string };
  "form.redirect":              { formSlug: string; url: string };
  // ── Submissão ────────────────────────────────────────────────────────────
  "form.submission.started":    { formSlug: string };
  "form.submission.retry":      { formSlug: string; attempt: number };
  "form.submission.succeeded":  {
    formSlug:      string;
    submissionId?: string;
    user_data?: {
      em?:                string[];   // SHA-256 hashed email(s)
      ph?:                string[];   // SHA-256 hashed phone(s)
      fn?:                string[];   // SHA-256 hashed first name(s)
      ln?:                string[];   // SHA-256 hashed last name(s)
      fbp?:               string;
      fbc?:               string;
      client_user_agent?: string;
    };
  };
  "form.submission.failed":     { formSlug: string; reason: string };
  // ── Conectividade ────────────────────────────────────────────────────────
  "form.offline":               { formSlug: string };
  "form.online":                { formSlug: string };
}

// ── Typed BusEvent alias ──────────────────────────────────────────────────────

export type FormBusEvent<T extends FormEventType = FormEventType> =
  BusEvent<T, T extends keyof FormEventPayloads ? FormEventPayloads[T] : unknown>;

// ── DB event name map ─────────────────────────────────────────────────────────
// Maps FormEventType → event name stored in form_events.event column.
// Only events listed here are persisted to the DB.

export const FORM_DB_EVENT_MAP: Partial<Record<FormEventType, string>> = {
  // ── Sessão ──────────────────────────────────────────────────────────────
  "form.loaded":                "page_loaded",
  "form.started":               "session_started",
  "form.resumed":               "session_resumed",
  "form.completed":             "session_completed",
  "form.restarted":             "restart",
  "form.abandoned":             "abandoned",
  "form.session.timeout":       "session_timeout",
  "form.error":                 "form_error",
  // ── Welcome ─────────────────────────────────────────────────────────────
  "form.welcome.viewed":        "welcome_view",
  "form.welcome.started":       "welcome_started",
  // ── Navegação ───────────────────────────────────────────────────────────
  "form.step.viewed":           "step_view",
  "form.step.completed":        "step_completed",
  "form.step.back":             "back_clicked",
  "form.step.skipped":          "step_skipped",
  "form.step.validation_error": "validation_error",
  // ── Respostas ────────────────────────────────────────────────────────────
  "form.answer.changed":        "answer_changed",
  "form.answer.cleared":        "answer_cleared",
  "form.answer.restored":       "answer_restored",
  // ── Lógica ──────────────────────────────────────────────────────────────
  "form.rule.matched":          "rule_matched",
  "form.rule.not_matched":      "rule_not_matched",
  "form.jump.executed":         "jump_executed",
  "form.ending.reached":        "ending_reached",
  "form.redirect":              "redirect_executed",
  // ── Submissão ────────────────────────────────────────────────────────────
  "form.submission.started":    "submission_started",
  "form.submission.succeeded":  "submission_finished",
};
