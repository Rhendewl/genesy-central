import { describe, it, expect } from "vitest";
import { signPayload, verifyPayload } from "../security/hmac";
import { PlainSecretProvider, EnvSecretProvider } from "../security/secret-provider";

// ── HMAC ──────────────────────────────────────────────────────────────────────

describe("signPayload()", () => {
  it("returns a sha256= prefixed hex string", async () => {
    const sig = await signPayload("hello world", "secret");
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("same body + secret produces same signature (deterministic)", async () => {
    const a = await signPayload("body", "secret");
    const b = await signPayload("body", "secret");
    expect(a).toBe(b);
  });

  it("different body produces different signature", async () => {
    const a = await signPayload("body1", "secret");
    const b = await signPayload("body2", "secret");
    expect(a).not.toBe(b);
  });

  it("different secret produces different signature", async () => {
    const a = await signPayload("body", "secret1");
    const b = await signPayload("body", "secret2");
    expect(a).not.toBe(b);
  });
});

describe("verifyPayload()", () => {
  it("returns true for matching signature", async () => {
    const body = JSON.stringify({ event: "form.started" });
    const sig  = await signPayload(body, "my-secret");
    expect(await verifyPayload(body, "my-secret", sig)).toBe(true);
  });

  it("returns false for tampered body", async () => {
    const sig = await signPayload("original body", "secret");
    expect(await verifyPayload("tampered body", "secret", sig)).toBe(false);
  });

  it("returns false for wrong secret", async () => {
    const sig = await signPayload("body", "secret");
    expect(await verifyPayload("body", "wrong-secret", sig)).toBe(false);
  });
});

// ── SecretProvider ────────────────────────────────────────────────────────────

describe("PlainSecretProvider", () => {
  it("returns secrets as-is", async () => {
    const provider = new PlainSecretProvider();
    const result   = await provider.resolve({ key1: "value1", key2: "value2" });
    expect(result).toEqual({ key1: "value1", key2: "value2" });
  });

  it("returns a copy (not same reference)", async () => {
    const provider = new PlainSecretProvider();
    const input    = { key: "val" };
    const result   = await provider.resolve(input);
    expect(result).not.toBe(input);
  });

  it("handles empty object", async () => {
    const provider = new PlainSecretProvider();
    expect(await provider.resolve({})).toEqual({});
  });
});

describe("EnvSecretProvider", () => {
  it("resolves $ENV_VAR references", async () => {
    process.env.TEST_SECRET_KEY = "resolved-value";
    const provider = new EnvSecretProvider();
    const result   = await provider.resolve({ token: "$TEST_SECRET_KEY" });
    expect(result.token).toBe("resolved-value");
    delete process.env.TEST_SECRET_KEY;
  });

  it("returns empty string for missing env var", async () => {
    const provider = new EnvSecretProvider();
    const result   = await provider.resolve({ missing: "$DOES_NOT_EXIST_XYZ" });
    expect(result.missing).toBe("");
  });

  it("passes through literal (non-$) values unchanged", async () => {
    const provider = new EnvSecretProvider();
    const result   = await provider.resolve({ literal: "my-api-key" });
    expect(result.literal).toBe("my-api-key");
  });

  it("handles mixed literal and env refs", async () => {
    process.env.INT_TEST_VAR = "from-env";
    const provider = new EnvSecretProvider();
    const result   = await provider.resolve({ a: "literal", b: "$INT_TEST_VAR" });
    expect(result.a).toBe("literal");
    expect(result.b).toBe("from-env");
    delete process.env.INT_TEST_VAR;
  });
});
