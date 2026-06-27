import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "../cursor";

describe("encodeCursor / decodeCursor", () => {
  it("encodes and decodes a cursor round-trip", () => {
    const ca = "2026-06-25T12:34:56.000Z";
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const encoded = encodeCursor(ca, id);
    expect(typeof encoded).toBe("string");
    expect(encoded).not.toBe("");
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({ ca, id });
  });

  it("produces URL-safe base64 (no +, /, =)", () => {
    const encoded = encodeCursor("2026-06-25T00:00:00.000Z", "some-uuid-here-000");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("returns null for empty string", () => {
    expect(decodeCursor("")).toBeNull();
  });

  it("returns null for invalid base64", () => {
    expect(decodeCursor("not-valid-base64!!!")).toBeNull();
  });

  it("returns null for valid base64 but invalid JSON", () => {
    const garbage = Buffer.from("not json").toString("base64url");
    expect(decodeCursor(garbage)).toBeNull();
  });

  it("returns null for JSON missing required fields", () => {
    const partial = Buffer.from(JSON.stringify({ ca: "2026-06-25" })).toString("base64url");
    expect(decodeCursor(partial)).toBeNull();
  });

  it("returns null when fields are wrong type", () => {
    const wrong = Buffer.from(JSON.stringify({ ca: 123, id: null })).toString("base64url");
    expect(decodeCursor(wrong)).toBeNull();
  });

  it("different inputs produce different cursors", () => {
    const c1 = encodeCursor("2026-06-25T00:00:00.000Z", "id-a");
    const c2 = encodeCursor("2026-06-25T00:00:00.000Z", "id-b");
    expect(c1).not.toBe(c2);
  });

  it("same inputs produce same cursor (deterministic)", () => {
    const c1 = encodeCursor("2026-06-25T12:00:00.000Z", "id-x");
    const c2 = encodeCursor("2026-06-25T12:00:00.000Z", "id-x");
    expect(c1).toBe(c2);
  });
});
