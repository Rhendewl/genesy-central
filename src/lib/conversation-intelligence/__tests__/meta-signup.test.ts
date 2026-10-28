import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  launchMetaSignup,
  type MetaLoginResponse,
  type MetaSdk,
} from "../meta-signup";

describe("Embedded Signup browser handshake", () => {
  let callback: (response: MetaLoginResponse) => void;
  let sdk: MetaSdk;
  let cleanup: (() => void) | undefined;
  const onFinish = vi.fn(),
    onFailure = vi.fn(),
    onSlow = vi.fn();
  const emit = (
    event = "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
    origin = "https://www.facebook.com",
    data: unknown = { phone_number_id: "123", waba_id: "456" },
  ) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin,
        data: JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event, data }),
      }),
    );
  const start = () =>
    (cleanup = launchMetaSignup({
      sdk,
      configId: "config",
      onFinish,
      onFailure,
      onSlow,
    }));
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sdk = {
      init: vi.fn(),
      login: vi.fn((cb) => {
        callback = cb;
      }),
    };
  });
  afterEach(() => {
    cleanup?.();
    vi.useRealTimers();
  });
  it("calls the SDK synchronously to retain browser user activation", () => {
    start();
    expect(sdk.login).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
  });
  it("handles the callback arriving before session metadata exactly once", () => {
    start();
    callback({ authResponse: { code: "code" } });
    expect(onFinish).not.toHaveBeenCalled();
    emit();
    emit();
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({
      code: "code",
      phoneId: "123",
      wabaId: "456",
    });
  });
  it("handles session metadata arriving before the callback", () => {
    start();
    emit();
    expect(onFinish).not.toHaveBeenCalled();
    callback({ authResponse: { code: "code" } });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
  it("also accepts v4 generic FINISH; server still verifies actual Coexistence", () => {
    start();
    callback({ authResponse: { code: "code" } });
    emit("FINISH");
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
  it("rejects forged origins and ignores unrelated messages", () => {
    start();
    callback({ authResponse: { code: "code" } });
    emit("FINISH", "https://attacker.example");
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://www.facebook.com",
        data: "not JSON",
      }),
    );
    expect(onFinish).not.toHaveBeenCalled();
    emit();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
  it("reports synchronous SDK exceptions instead of leaving the button silent", () => {
    sdk.login = () => {
      throw new Error("sdk disabled");
    };
    start();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toContain("SDK do JavaScript");
    vi.advanceTimersByTime(600000);
    expect(onSlow).not.toHaveBeenCalled();
  });
  it("reports a canceled/blocked callback without code", () => {
    start();
    callback({ status: "unknown" });
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toContain("não retornou autorização");
  });
  it("offers help after 8s without aborting a legitimate slow authorization", () => {
    start();
    vi.advanceTimersByTime(8000);
    expect(onSlow).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    callback({ authResponse: { code: "code" } });
    emit();
    expect(onFinish).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(600000);
    expect(onFailure).not.toHaveBeenCalled();
  });
  it("expires the attempt and ignores a later callback", () => {
    start();
    vi.advanceTimersByTime(600000);
    expect(onFailure).toHaveBeenCalledTimes(1);
    callback({ authResponse: { code: "code" } });
    emit();
    expect(onFinish).not.toHaveBeenCalled();
  });
  it("removes listeners and timers when the user cancels or the component unmounts", () => {
    start();
    cleanup?.();
    callback({ authResponse: { code: "code" } });
    emit();
    vi.advanceTimersByTime(600000);
    expect(onFinish).not.toHaveBeenCalled();
    expect(onSlow).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });
  it("does not send incomplete phone/account metadata to the backend", () => {
    start();
    callback({ authResponse: { code: "code" } });
    emit("FINISH", "https://www.facebook.com", {
      phone_number_id: 123,
      waba_id: "456",
    });
    expect(onFinish).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
  it("cleans up after Meta cancel/error events", () => {
    start();
    emit("ERROR");
    expect(onFailure).toHaveBeenCalledTimes(1);
    callback({ authResponse: { code: "code" } });
    emit();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
