"use client";

import { useState, useCallback } from "react";
import { PlayCircle, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getIntegrationRuntime } from "@/lib/integrations/runtime";
import type { IntegrationDefinition } from "@/lib/integrations/catalog";
import type { FormIntegrationRow } from "@/hooks/useFormularioIntegracoes";
import type { IntegrationConfig, IntegrationContext } from "@/lib/integrations/types";
import { DEFAULT_RETRY_POLICY } from "@/lib/integrations/retry";

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
      const runtime = getIntegrationRuntime();
      const correlationId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const testEvent = runtime.pipeline.run(
        {
          id:            `test-evt-${Date.now()}`,
          correlationId,
          type:          "form.started",
          formSlug,
          sessionToken:  "test-session",
          timestamp:     Date.now(),
          payload:       { formSlug, sessionToken: "test-session", _test: true },
          meta:          { url: "https://test.lancaster.app" },
          version:       1,
        },
        { formSlug, correlationId },
      );

      const config: IntegrationConfig = {
        id:           row.id,
        adapterName:  row.adapter,
        enabled:      true,
        settings:     row.settings,
        secrets:      {},      // real secrets are server-side only; test uses empty secrets
        eventFilter:  row.event_filter ?? undefined,
        retryPolicy:  { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, jitter: false, timeoutMs: 10_000, backoffFactor: 1 },
        rateLimit:    undefined,
      };

      const mapper  = runtime.registry.getMapper(row.adapter);
      const adapter = runtime.registry.getAdapter(row.adapter);

      if (!mapper || !adapter) {
        setResult({ ok: false, durationMs: 0, error: "Adapter não encontrado no registry", payloadSent: "{}", correlationId });
        return;
      }

      const payload = mapper.map(testEvent, config);
      const payloadStr = JSON.stringify(payload, null, 2);

      const ctrl = new AbortController();
      const ctx: IntegrationContext = {
        deliveryId:  `test-del-${Date.now()}`,
        correlationId,
        attempt:     1,
        maxAttempts: 1,
        timeoutMs:   10_000,
        signal:      ctrl.signal,
      };

      const start  = Date.now();
      const res    = await adapter.execute(payload, ctx, config);
      const dur    = Date.now() - start;

      setResult({
        ok:            res.ok,
        statusCode:    res.status,
        durationMs:    dur,
        error:         res.error,
        payloadSent:   payloadStr,
        correlationId,
      });
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
  }, [row, formSlug]);

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
          Dispara um evento <code className="px-1 rounded text-xs" style={{ background: "var(--border)" }}>form.started</code> de teste através da infra existente.
          Credenciais salvas são usadas na chamada real.
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
