"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#080808", color: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>Não foi possível exibir a plataforma</h1>
            <p style={{ margin: "10px 0 20px", color: "#a3a3a3", fontSize: 14, lineHeight: 1.5 }}>
              Seus dados continuam salvos. Tente reconectar ou reabrir a plataforma.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                border: "1px solid #3f3f46",
                borderRadius: 12,
                background: "#f4f4f5",
                color: "#09090b",
                padding: "10px 16px",
                fontWeight: 600,
              }}
            >
              Tentar novamente
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
