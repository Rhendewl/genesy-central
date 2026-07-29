import { afterEach, describe, expect, it, vi } from "vitest";
import { deferAuthStateWork } from "@/lib/auth/defer-auth-state-work";

describe("deferAuthStateWork", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("nunca executa trabalho Supabase dentro do callback de autenticação", () => {
    vi.useFakeTimers();
    const work = vi.fn();

    deferAuthStateWork(work);

    expect(work).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(work).toHaveBeenCalledOnce();
  });
});
