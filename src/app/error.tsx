"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Genesy route error", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div
        className="w-full max-w-md rounded-3xl border p-6 text-center"
        style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}
      >
        <h1 className="text-lg font-semibold text-[var(--text-title)]">
          A plataforma precisa se reconectar
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Seus dados continuam salvos. Verifique a conexão e tente carregar a tela novamente.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={reset} className="lc-btn px-4 py-2 text-sm">
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border px-4 py-2 text-sm text-[var(--text-title)]"
            style={{ borderColor: "var(--glass-border)" }}
          >
            Reabrir plataforma
          </button>
        </div>
      </div>
    </main>
  );
}
