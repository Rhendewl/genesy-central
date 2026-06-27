import { describe, it, expect } from "vitest";
import type {
  SubmissionStatus, SubmissionListItem, SubmissionStats,
  SubmissionsListResponse, SubmissionDetail, SessionEvent,
  IntegrationDelivery, SubmissionPatch, Cursor, RespostasParams,
} from "../types";

// Type-level tests: if the file compiles, the types are correct.
// Runtime tests verify the shape of literal objects matches the types.

describe("Types — shape validation", () => {
  it("SubmissionListItem has all required fields", () => {
    const item: SubmissionListItem = {
      id: "id-1", form_id: "form-1", session_id: null, correlation_id: null,
      status: "completed", answers: { q1: "Ana" }, score: null,
      step_timings: { s1: 4000 }, drop_off_step: null, time_on_form_ms: 4000,
      read_at: null, starred: false, archived: false,
      completed_at: "2026-06-25T12:00:00.000Z",
      created_at: "2026-06-25T11:00:00.000Z", updated_at: "2026-06-25T12:00:00.000Z",
      session_token: null, device: "mobile", browser: "Chrome", os: "iOS",
      country: "BR", city: null, utm_source: "google", utm_medium: "cpc",
      utm_campaign: null, utm_term: null, utm_content: null,
      fbclid: null, gclid: null, referrer: null,
      form_name: "Lead Form", form_slug: "lead-form",
    };
    expect(item.id).toBe("id-1");
    expect(item.form_name).toBe("Lead Form");
  });

  it("SubmissionStats has correct numeric fields", () => {
    const stats: SubmissionStats = {
      total: 100, completed: 78, abandoned: 22,
      completionRate: 0.78, avgTimeOnFormMs: 225000,
    };
    expect(stats.completionRate).toBe(0.78);
    expect(stats.completionRate).toBeGreaterThanOrEqual(0);
    expect(stats.completionRate).toBeLessThanOrEqual(1);
  });

  it("SubmissionsListResponse structure", () => {
    const res: SubmissionsListResponse = {
      items: [], nextCursor: null,
      stats: { total: 0, completed: 0, abandoned: 0, completionRate: 0, avgTimeOnFormMs: 0 },
    };
    expect(res.items).toHaveLength(0);
    expect(res.nextCursor).toBeNull();
  });

  it("SessionEvent has required fields", () => {
    const evt: SessionEvent = {
      id: "ev-1", step_id: "step-2", event: "step_view",
      duration: 3000, created_at: "2026-06-25T11:01:00.000Z", meta: null,
    };
    expect(evt.event).toBe("step_view");
  });

  it("IntegrationDelivery has required fields", () => {
    const d: IntegrationDelivery = {
      id: "d-1", adapter_name: "meta-pixel", event_id: "ev-1",
      correlation_id: "corr-1", event_type: "form.completed",
      attempt: 1, ok: true, status_code: 200, duration_ms: 340,
      error: null, delivered_at: "2026-06-25T12:00:01.000Z",
    };
    expect(d.ok).toBe(true);
  });

  it("SubmissionPatch only includes allowed fields", () => {
    const patch: SubmissionPatch = { starred: true, archived: false };
    expect(patch.starred).toBe(true);
    // read_at and status are also valid
    const fullPatch: SubmissionPatch = {
      starred: false, archived: true,
      read_at: "2026-06-25T12:00:00.000Z", status: "completed",
    };
    expect(fullPatch.status).toBe("completed");
  });

  it("Cursor has ca and id", () => {
    const cursor: Cursor = { ca: "2026-06-25T12:00:00.000Z", id: "some-uuid" };
    expect(typeof cursor.ca).toBe("string");
    expect(typeof cursor.id).toBe("string");
  });

  it("RespostasParams accepts all filter fields", () => {
    const params: RespostasParams = {
      form_id: "f1", cursor: "abc", limit: 50, q: "Ana",
      status: "completed", starred: true, archived: false,
      sort: "created_at", direction: "desc",
    };
    expect(params.limit).toBe(50);
  });

  it("all SubmissionStatus values are accepted", () => {
    const statuses: SubmissionStatus[] = [
      "partial", "started", "completed", "spam", "abandoned",
    ];
    expect(statuses).toHaveLength(5);
  });
});
