"use client";

import { useState, useCallback } from "react";
import { PlayCircle, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IntegrationDefinition } from "@/lib/integrations/catalog";
import type { FormIntegrationRow } from "@/hooks/useFormularioIntegracoes";

interface TestResult {
  ok:          boolean;
  statusCode?: number;
  durationMs:  number;
  error?:      string;
  payloadSent: string;
  correlationId: string;
}

interface TestPanelProps {
  definition: IntegrationDefinition;
  row?:       FormIntegrationRow;
  formSlug:   string;
}

export function TestPanel({ definition, row, formSlug }: TestPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result,    setResult]    = useState<TestResult | null>(null);

  const runTest = useCallback(async () => {
    if (!row) return;
    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch(
        `/api/formularios/${row.form_id}/integracoes/${row.id}/test`,
        { method: "POST" },
      );
      const json = await response.json() as TestResult;
      setResult(json);
    } catch (err) {
      setResult({
        ok:            false,
        durationMs:    0,
        error:         String(err),
        payloadSent:   "{}",
        correlationId: "",
      });
    } finally {
      setIsRunning(false);
    }
  }, [row]);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: "var(--background)", border: "1px solid var(--border)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>
          Teste de integração
        </p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Dispara um evento <code className="px-1 rounded text-xs" style={{ background: "var(--border)" }}>{row?.adapter === "webhook" ? "form.webhook.test" : "form.started"}</code> de teste através da infra existente.
          {row?.adapter === "webhook" ? " A chamada é feita no servidor com a assinatura HMAC salva." : " Credenciais salvas são usadas na chamada real."}
        </p>
        {!row && (
          <p className="text-xs text-amber-400">
            ⚠ Salve a configuração antes de testar.
          </p>
        )}
      </div>

      <Button
        onClick={runTest}
        disabled={isRunning || !row}
        className="w-full"
      >
        {isRunning ? (
          <><Loader2 size={14} className="animate-spin" /> Testando…</>
        ) : (
          <><PlayCircle size={14} /> Testar integração</>
        )}
      </Button>

      {result && (
        <div className="space-y-3">
          {/* Status */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: result.ok ? "#22c55e12" : "#ef444412", border: `1px solid ${result.ok ? "#22c55e30" : "#ef444430"}` }}
          >
            <div className="flex items-center gap-2">
              {result.ok
                ? <CheckCircle2 size={16} color="#22c55e" />
                : <XCircle size={16} color="#ef4444" />
              }
              <span className="text-sm font-medium" style={{ color: result.ok ? "#22c55e" : "#ef4444" }}>
                {result.ok ? "Sucesso" : "Falha"}
              </span>
              {result.statusCode && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--muted-foreground)" }}>
                  HTTP {result.statusCode}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <Clock size={12} />
              {result.durationMs}ms
            </span>
          </div>

          {/* Erro */}
          {result.error && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: "#ef444410", border: "1px solid #ef444430" }}>
              <p className="text-xs font-medium text-red-400">Erro</p>
              <p className="text-xs font-mono break-all" style={{ color: "#f87171" }}>{result.error}</p>
            </div>
          )}

          {/* correlationId */}
          <div className="rounded-xl p-3" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Correlation ID</p>
            <p className="text-xs font-mono" style={{ color: "var(--text-title)" }}>{result.correlationId}</p>
          </div>

          {/* Payload enviado */}
          <div className="rounded-xl p-3" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>Payload enviado</p>
            <pre
              className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto"
              style={{ color: "var(--text-title)" }}
            >
              {result.payloadSent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
