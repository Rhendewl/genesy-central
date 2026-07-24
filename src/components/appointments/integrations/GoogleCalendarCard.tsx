"use client";

import { useState, useEffect, useCallback } from "react";
import Image                                 from "next/image";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Link2, Unlink2 } from "lucide-react";
import type { GoogleCalendarConnection, GoogleSyncStatus } from "@/types/google-calendar";

interface GoogleConnectionState {
  connected:  boolean;
  connection: GoogleCalendarConnection | null;
}

export function GoogleCalendarCard() {
  const [state,          setState]          = useState<GoogleConnectionState | null>(null);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isToggling,     setIsToggling]     = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch("/api/google-calendar/status");
      const data = await res.json() as GoogleConnectionState;
      setState(data);
    } catch {
      setState({ connected: false, connection: null });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  async function handleConnect() {
    window.location.href = "/api/google-calendar/connect";
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar o Google Calendar? Os agendamentos já sincronizados não serão afetados.")) return;
    setIsDisconnecting(true);
    try {
      await fetch("/api/google-calendar/disconnect", { method: "POST" });
      await fetchStatus();
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleToggleAutoCreate(value: boolean) {
    setIsToggling(true);
    try {
      await fetch("/api/google-calendar/status", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ auto_create_events: value }),
      });
      setState(prev => prev && prev.connection
        ? { ...prev, connection: { ...prev.connection, auto_create_events: value } }
        : prev,
      );
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--accent)" }}
        >
          {/* Google Calendar icon */}
          <svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="36" height="36" rx="4" fill="white" stroke="#E5E7EB" strokeWidth="1.5" />
            <rect x="6" y="14" width="36" height="5" fill="#4285F4" />
            <rect x="6" y="6" width="36" height="8" rx="4" fill="#4285F4" />
            <circle cx="16" cy="10" r="3" fill="white" />
            <circle cx="32" cy="10" r="3" fill="white" />
            <text x="24" y="35" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#4285F4">
              {new Date().getDate()}
            </text>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            Google Calendar
          </p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Cria eventos automaticamente ao confirmar agendamentos
          </p>
        </div>
        <div className="ml-auto shrink-0">
          <StatusDot status={isLoading ? null : state?.connected ?? false} />
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      ) : state?.connected && state.connection ? (
        <ConnectedBody
          connection={state.connection}
          isDisconnecting={isDisconnecting}
          isToggling={isToggling}
          onDisconnect={handleDisconnect}
          onToggleAutoCreate={handleToggleAutoCreate}
        />
      ) : (
        <DisconnectedBody onConnect={handleConnect} />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: boolean | null }) {
  if (status === null) return <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />;
  return (
    <div
      className="w-2 h-2 rounded-full"
      style={{ background: status ? "var(--success, #22c55e)" : "var(--muted-foreground)" }}
    />
  );
}

function ConnectedBody({
  connection,
  isDisconnecting,
  isToggling,
  onDisconnect,
  onToggleAutoCreate,
}: {
  connection:       GoogleCalendarConnection;
  isDisconnecting:  boolean;
  isToggling:       boolean;
  onDisconnect:     () => void;
  onToggleAutoCreate: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Account info */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={{ background: "var(--accent)" }}
      >
        {connection.google_account_picture ? (
          <Image
            src={connection.google_account_picture}
            alt={connection.google_account_name ?? "Google account"}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
            style={{ background: "#b0b8c1", color: "#000000" }}
          >
            {(connection.google_account_name ?? connection.google_account_email)[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          {connection.google_account_name && (
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-title)" }}>
              {connection.google_account_name}
            </p>
          )}
          <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
            {connection.google_account_email}
          </p>
        </div>
        <CheckCircle2 size={16} className="ml-auto shrink-0" style={{ color: "#22c55e" }} />
      </div>

      {/* Auto-create toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--text-title)" }}>
          Criar eventos automaticamente
        </p>
        <button
          onClick={() => onToggleAutoCreate(!connection.auto_create_events)}
          disabled={isToggling}
          role="switch"
          aria-checked={connection.auto_create_events}
          className="relative w-10 h-5.5 rounded-full transition-colors shrink-0 disabled:opacity-60"
          style={{
            background: connection.auto_create_events ? "var(--primary)" : "var(--border)",
            width: "40px",
            height: "22px",
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform shadow"
            style={{
              width:  "18px",
              height: "18px",
              transform: connection.auto_create_events ? "translateX(18px)" : "translateX(0)",
            }}
          />
        </button>
      </div>

      {/* Last sync status */}
      <SyncStatusRow
        status={connection.last_sync_status}
        lastSyncAt={connection.last_sync_at}
        lastError={connection.last_error}
      />

      {/* Disconnect */}
      <button
        onClick={onDisconnect}
        disabled={isDisconnecting}
        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors self-start disabled:opacity-60"
        style={{
          borderColor: "var(--border)",
          color:       "var(--muted-foreground)",
        }}
      >
        {isDisconnecting
          ? <Loader2 size={12} className="animate-spin" />
          : <Unlink2 size={12} />}
        Desconectar
      </button>
    </div>
  );
}

function DisconnectedBody({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
        <XCircle size={14} />
        Nenhuma conta conectada
      </div>
      <button
        onClick={onConnect}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 self-start"
        style={{ background: "#b0b8c1", color: "#000000" }}
      >
        <Link2 size={14} />
        Conectar Google Calendar
      </button>
    </div>
  );
}

function SyncStatusRow({
  status,
  lastSyncAt,
  lastError,
}: {
  status:     GoogleSyncStatus;
  lastSyncAt: string | null;
  lastError:  string | null;
}) {
  const labels: Record<GoogleSyncStatus, string> = {
    idle:    "Aguardando",
    syncing: "Sincronizando…",
    success: "Sincronizado",
    error:   "Erro na sincronização",
  };

  const colors: Record<GoogleSyncStatus, string> = {
    idle:    "var(--muted-foreground)",
    syncing: "var(--primary)",
    success: "#22c55e",
    error:   "#ef4444",
  };

  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: colors[status] }}>
      {status === "syncing" && <RefreshCw size={12} className="animate-spin" />}
      <span>{labels[status]}</span>
      {lastSyncAt && status === "success" && (
        <span style={{ color: "var(--muted-foreground)" }}>
          · {new Date(lastSyncAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      )}
      {lastError && status === "error" && (
        <span title={lastError} className="truncate max-w-[180px]" style={{ color: "var(--muted-foreground)" }}>
          · {lastError}
        </span>
      )}
    </div>
  );
}
