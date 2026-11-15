"use client";
import { useEffect, useState } from "react";
import { useCurrentMember } from "@/context/CurrentMemberContext";

type ReviewConfig = { configured: boolean; recipientLabel: string | null };
type Inspection = {
  accountId: string;
  phone: { id: string; name: string; displayNumber: string };
  inspectedAt: string;
};
type Receipt = {
  accepted: boolean;
  messageId: string;
  acceptedAt: string;
  recipientLabel: string;
};
const endpoint = "/api/crm/conversation-intelligence/review";
export function MetaReviewTools() {
  const { isOwner } = useCurrentMember();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ReviewConfig | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  useEffect(() => {
    if (!isOwner || !open) return;
    let active = true;
    void fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error ?? "Não foi possível consultar a configuração.",
          );
        if (active) setConfig(body);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [isOwner, open]);
  if (!isOwner) return null;
  async function run(action: "inspect" | "send") {
    setBusy(true);
    setError("");
    setReceipt(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Não foi possível concluir.");
      if (action === "inspect") setInspection(body);
      else {
        setReceipt(body);
        setToken("");
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const button = "rounded-xl border px-4 py-2 text-sm disabled:opacity-40";
  return (
    <details
      className="rounded-2xl border p-4"
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        setOpen(nextOpen);
        if (!nextOpen) {
          setToken("");
          setError("");
          setInspection(null);
          setReceipt(null);
        }
      }}
    >
      <summary className="cursor-pointer font-medium">
        Demonstração para análise da Meta · Administrador
      </summary>
      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-sm">
            Envie a mensagem de exemplo hello_world pelo número de teste da
            Meta. O envio só acontece ao clicar no botão e usa apenas o
            destinatário confirmado configurado pelo administrador.
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Esta demonstração permite gravar uma operação real da API. Ela não
            conecta o número de um SDR, não importa conversas e não comprova a
            aprovação de Coexistence. A resposta de aceitação também não
            confirma entrega: confira a mensagem recebida no WhatsApp.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-amber-500 p-3 text-sm"
            >
              {error}
            </p>
          )}
          {!config ? (
            <p className="text-sm">Consultando configuração…</p>
          ) : !config.configured ? (
            <p className="rounded-xl border p-3 text-sm">
              A demonstração aguarda a configuração do número de teste e do
              destinatário na Vercel.
            </p>
          ) : (
            <>
              <p className="text-sm">
                Destino: <strong>{config.recipientLabel}</strong>
              </p>
              <label className="block text-sm">
                Token temporário do número de teste da Meta
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className="lc-form-control mt-1"
                  placeholder="Cole o token gerado na Configuração da API da Meta"
                  disabled={busy}
                />
              </label>
              <p className="text-xs text-[var(--muted-foreground)]">
                O token é enviado ao servidor da Genesy e à API oficial da Meta
                para esta operação. Ele não é salvo no banco nem neste
                navegador. Ao fechar esta seção ou concluir um envio, o campo é
                limpo. Durante a gravação, mantenha o token oculto.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || token.trim().length < 20}
                  className={button}
                  onClick={() => void run("inspect")}
                >
                  {busy ? "Processando…" : "Consultar conta de teste"}
                </button>
                <button
                  type="button"
                  disabled={busy || token.trim().length < 20}
                  className={button}
                  onClick={() => void run("send")}
                >
                  {busy
                    ? "Processando…"
                    : "Enviar hello_world ao meu WhatsApp de teste"}
                </button>
              </div>
            </>
          )}
          {inspection && (
            <div
              role="status"
              className="space-y-1 rounded-xl border p-3 text-sm"
            >
              <p className="font-medium">Consulta autorizada pela Meta</p>
              <p>Conta: {inspection.accountId}</p>
              <p>Número de teste: {inspection.phone.displayNumber}</p>
              <p>ID do número: {inspection.phone.id}</p>
              <p>Nome: {inspection.phone.name}</p>
            </div>
          )}
          {receipt && (
            <div
              role="status"
              className="space-y-1 rounded-xl border border-emerald-500 p-3 text-sm"
            >
              <p className="font-medium">
                Solicitação de envio aceita pela Meta
              </p>
              <p>Destino: {receipt.recipientLabel}</p>
              <p className="break-all">ID da mensagem: {receipt.messageId}</p>
              <p>
                Agora confira a chegada no WhatsApp e mostre a mensagem recebida
                na gravação.
              </p>
            </div>
          )}
        </div>
      )}
    </details>
  );
}
