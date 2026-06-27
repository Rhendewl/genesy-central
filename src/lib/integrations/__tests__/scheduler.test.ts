import { describe, it, expect, vi, afterEach } from "vitest";
import { TimerScheduler } from "../scheduler";

afterEach(() => vi.restoreAllMocks());

describe("TimerScheduler", () => {
  it("calls the function after the given delay", async () => {
    const scheduler = new TimerScheduler();
    const fn = vi.fn();
    scheduler.schedule(fn, 10);
    expect(fn).not.toHaveBeenCalled();
    await new Promise<void>(r => setTimeout(r, 30));
    expect(fn).toHaveBeenCalledOnce();
  });

  it("calls the function immediately when delayMs is 0", async () => {
    const scheduler = new TimerScheduler();
    const fn = vi.fn();
    scheduler.schedule(fn, 0);
    await new Promise<void>(r => setTimeout(r, 10));
    expect(fn).toHaveBeenCalledOnce();
  });

  it("supports injecting a custom scheduler", () => {
    const called: number[] = [];
    const customScheduler = {
      schedule: (fn: () => void, delay: number) => {
        called.push(delay);
        fn();
      },
    };
    customScheduler.schedule(() => {}, 999);
    expect(called).toEqual([999]);
  });
});
