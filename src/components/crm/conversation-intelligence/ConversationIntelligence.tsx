"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAgencyClients } from "@/hooks/useAgencyClients";

type Finding = {
  category: string;
  label: string;
  evidence_ids?: string[];
  confidence: number;
};
type Data = {
  configuration?: { ready: boolean };
  connection?: {
    id: string;
    display_phone: string;
    status: string;
    last_event_at: string | null;
  } | null;
  consents?: Array<{
    id: string;
    contact_label: string;
    allow_ai: boolean;
    share_summary: boolean;
    revoked_at: string | null;
    expires_at: string;
  }>;
  metrics: {
    conversations: number;
    messages: number;
    attended: number;
    contacted: number;
    replied: number;
    responseRate: number | null;
    medianFirstResponseSeconds: number | null;
    firstResponseSamples: number;
    followups: number;
    awaitingSdr: number;
    awaitingLead: number;
  };
  analyses: Array<{
    consent_id?: string;
    generated_at: string;
    findings: Finding[];
  }>;
  coverage: string;
  messages: Array<{
    id: string;
    direction: string;
    sent_at: string;
    text: string | null;
    kind: string;
  }>;
};
type Facebook = {
  init: (options: Record<string, unknown>) => void;
  login: (
    cb: (response: { authResponse?: { code?: string } }) => void,
    options: Record<string, unknown>,
  ) => void;
};
const endpoint = "/api/crm/conversation-intelligence";
async function request(path: string, body?: unknown) {
  const r = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const json = await r.json();
  if (!r.ok) throw new Error(json.error ?? "Não foi possível concluir");
  return json;
}
export function ConversationIntelligence({ clientId }: { clientId?: string }) {
  const { clients } = useAgencyClients();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(7);
  const [selected, setSelected] = useState("");
  const [phone, setPhone] = useState("");
  const [evidence, setEvidence] = useState("");
  const [client, setClient] = useState("");
  const [allowAi, setAllowAi] = useState(false);
  const [share, setShare] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const cleanup = useRef<() => void>();
  const launch = useRef<() => void>();
  const [prepared, setPrepared] = useState(false);
  const load = useCallback(async () => {
    setError("");
    setData(null);
    try {
      setData(
        await request(
          `${endpoint}?days=${days}${clientId ? `&client_id=${clientId}` : ""}${selected && !clientId ? `&consent_id=${selected}` : ""}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [days, clientId, selected]);
  useEffect(() => {
    void load();
    return () => cleanup.current?.();
  }, [load]);
  async function act(body: unknown, path = endpoint) {
    setBusy(true);
    setError("");
    try {
      await request(path, body);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const config = await request(`${endpoint}/connect`, { action: "start" });
      const win = window as Window & { FB?: Facebook };
      if (!win.FB)
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://connect.facebook.net/en_US/sdk.js";
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Não foi possível abrir a Meta"));
          document.head.appendChild(s);
        });
      const fb = win.FB;
      if (!fb) throw new Error("SDK Meta indisponível");
      fb.init({
        appId: config.appId,
        version: config.version,
        cookie: false,
        xfbml: false,
      });
      launch.current = () => {
        setPrepared(false);
        setBusy(true);
        let code = "",
          phoneId = "",
          wabaId = "",
          submitted = false;
        const stop = () => {
          window.removeEventListener("message", listener);
          window.clearTimeout(timer);
        };
        const finish = async () => {
          if (!code || !phoneId || !wabaId || submitted) return;
          submitted = true;
          stop();
          await act(
            {
              action: "finish",
              session: config.session,
              code,
              phoneId,
              wabaId,
            },
            `${endpoint}/connect`,
          );
        };
        const listener = (event: MessageEvent) => {
          if (
            !["https://www.facebook.com", "https://web.facebook.com"].includes(
              event.origin,
            )
          )
            return;
          let msg;
          try {
            msg =
              typeof event.data === "string"
                ? JSON.parse(event.data)
                : event.data;
          } catch {
            return;
          }
          if (msg?.type !== "WA_EMBEDDED_SIGNUP") return;
          if (msg.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
            phoneId = msg.data?.phone_number_id;
            wabaId = msg.data?.waba_id;
            void finish();
          } else if (["CANCEL", "ERROR"].includes(msg.event)) {
            stop();
            setBusy(false);
            setError("Conexão não concluída na Meta.");
          }
        };
        const timer = window.setTimeout(() => {
          stop();
          setBusy(false);
          setError("Conexão expirada. Tente novamente.");
        }, 600000);
        cleanup.current = stop;
        window.addEventListener("message", listener);
        fb.login(
          (response) => {
            code = response.authResponse?.code ?? "";
            if (!code) {
              stop();
              setBusy(false);
              return;
            }
            void finish();
          },
          {
            config_id: config.configId,
            response_type: "code",
            override_default_response_type: true,
            extras: {
              featureType: "whatsapp_business_app_onboarding",
              sessionInfoVersion: "3",
            },
          },
        );
      };
      setPrepared(true);
      setBusy(false);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const button = "rounded-xl border px-4 py-2 text-sm disabled:opacity-40";
  const m = data?.metrics;
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Inteligência de Conversas</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {clientId
              ? "Conversas autorizadas para consolidação deste cliente."
              : "Continue atendendo pelo WhatsApp Business. Escolha quais conversas a Genesy pode analisar."}
          </p>
        </div>
        <label className="text-sm">
          Período{" "}
          <select
            className="rounded-lg border bg-[var(--bg)] p-2"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 14, 30].map((n) => (
              <option key={n} value={n}>
                {n} dias
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-amber-500 p-4">
          {error}
        </p>
      )}
      {!clientId && (
        <div className="space-y-3 rounded-2xl border p-4">
          <h3 className="font-medium">Meu WhatsApp Business</h3>
          {data?.connection ? (
            <>
              <p>
                {data.connection.display_phone} ·{" "}
                {{
                  connected: "Conectado",
                  paused: "Coleta pausada",
                  reauthorization_required: "Reconexão necessária",
                }[data.connection.status] ?? data.connection.status}
              </p>
              <p className="text-xs">
                Última mensagem autorizada recebida:{" "}
                {data.connection.last_event_at
                  ? new Date(data.connection.last_event_at).toLocaleString(
                      "pt-BR",
                    )
                  : "nenhuma"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  disabled={
                    busy ||
                    data.connection.status === "reauthorization_required"
                  }
                  onClick={() =>
                    void act({
                      action:
                        data.connection?.status === "paused"
                          ? "resume"
                          : "pause",
                    })
                  }
                >
                  {data.connection.status === "paused"
                    ? "Retomar coleta"
                    : "Pausar coleta"}
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => void act({ action: "check" })}
                >
                  Verificar conexão
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Desconectar e excluir todas as mensagens e análises deste número na Genesy?",
                      )
                    )
                      void act({ action: "disconnect" });
                  }}
                >
                  Desconectar e excluir dados
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">
                {data?.configuration?.ready
                  ? "A Meta confirmará se seu número permite continuar usando o aplicativo."
                  : "Conexão aguardando configuração e aprovação da Meta."}
              </p>
              <button
                className={button}
                disabled={busy || !data?.configuration?.ready}
                onClick={() => (prepared ? launch.current?.() : void connect())}
              >
                {prepared ? "Continuar na Meta" : "Conectar pela Meta"}
              </button>
            </>
          )}
        </div>
      )}
      {m && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Conversas observadas", m.conversations],
              ["Contatos atendidos", m.attended],
              [
                "Contatos que responderam",
                m.responseRate === null
                  ? "—"
                  : `${(m.responseRate * 100).toFixed(1)}% (${m.replied}/${m.contacted})`,
              ],
              [
                "Primeira resposta · mediana",
                m.medianFirstResponseSeconds === null
                  ? "—"
                  : `${Math.round(m.medianFirstResponseSeconds / 60)} min · ${m.firstResponseSamples} amostras`,
              ],
              ["Follow-ups observados", m.followups],
              ["Aguardando SDR ≥48h", m.awaitingSdr],
              ["Aguardando contato ≥48h", m.awaitingLead],
              ["Mensagens observadas", m.messages],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-4">
                <p className="text-xs text-[var(--muted-foreground)]">
                  {label}
                </p>
                <p className="mt-2 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <details className="rounded-xl border p-3 text-xs">
            <summary>Como os números são calculados</summary>
            <p className="mt-2">
              {data?.coverage} A taxa usa contatos com mensagem de saída no
              período e resposta posterior. A primeira resposta mede a primeira
              entrada observada até a próxima saída. Follow-up é uma saída após
              outra saída, sem entrada entre elas e com intervalo mínimo de 24h.
              Ausência de resposta usa a última mensagem observada. Os números
              representam contatos por conexão, não pessoas únicas entre SDRs.
              Nenhuma destas métricas é estimada pela IA.
            </p>
          </details>
        </>
      )}
      {!clientId && data?.connection && (
        <form
          className="space-y-3 rounded-2xl border p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await act({
              action: "consent",
              phone,
              evidence,
              clientId: client,
              allowAi,
              share,
              confirmed,
            });
          }}
        >
          <h3 className="font-medium">Autorizar uma conversa</h3>
          <p className="text-xs">
            Somente novas mensagens após a autorização. Conteúdo retido por 30
            dias; autorização válida por 90 dias. Não inclua dados sensíveis na
            referência.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Telefone com DDI
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="lc-form-control"
                placeholder="+55 85 99999-9999"
              />
            </label>
            <label className="text-sm">
              Cliente para Análise Comercial
              <select
                className="lc-form-control"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              >
                <option value="">Sem vínculo</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Referência da autorização
            <input
              required
              minLength={10}
              maxLength={500}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              className="lc-form-control"
              placeholder="Registro e data da autorização do contato"
            />
          </label>
          <label className="block text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
            />{" "}
            Confirmo que o contato foi informado e autorizou a coleta para
            análise comercial.
          </label>
          <label className="block text-sm">
            <input
              type="checkbox"
              checked={allowAi}
              onChange={(e) => setAllowAi(e.target.checked)}
            />{" "}
            A autorização inclui processamento por IA externa (Anthropic). Nomes
            e outros dados livres podem constar nas mensagens.
          </label>
          <label className="block text-sm">
            <input
              type="checkbox"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
            />{" "}
            Compartilhar indicadores e interpretações com os gestores do cliente
            selecionado.
          </label>
          <button className={button} disabled={busy || !confirmed}>
            Autorizar novas mensagens
          </button>
        </form>
      )}
      {!clientId && (
        <div className="space-y-3">
          {data?.consents?.map((c) => (
            <article
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
            >
              <span className="flex-1">
                {c.contact_label} ·{" "}
                {c.revoked_at
                  ? "Revogada"
                  : Date.parse(c.expires_at) < Date.now()
                    ? "Expirada"
                    : "Autorizada"}
              </span>
              {!c.revoked_at && Date.parse(c.expires_at) > Date.now() && (
                <>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => setSelected(c.id)}
                  >
                    Ver mensagens
                  </button>
                  <button
                    className={button}
                    disabled={busy || !c.allow_ai}
                    onClick={() =>
                      void act({ id: c.id }, `${endpoint}/analyze`)
                    }
                  >
                    Analisar com IA
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Revogar autorização e excluir conteúdo e análises desta conversa?",
                        )
                      ) {
                        setSelected("");
                        void act({ action: "revoke", id: c.id });
                      }
                    }}
                  >
                    Revogar e excluir
                  </button>
                </>
              )}
            </article>
          ))}
        </div>
      )}
      {selected && !clientId && (
        <div className="space-y-2 rounded-xl border p-4">
          <h3>Últimas 200 mensagens no período</h3>
          {data?.messages.map((msg) => (
            <div
              key={msg.id}
              id={msg.id}
              className="rounded-lg bg-[var(--hover)] p-3"
            >
              <p className="text-xs">
                {msg.direction === "inbound" ? "Contato" : "SDR"} ·{" "}
                {new Date(msg.sent_at).toLocaleString("pt-BR")} · {msg.id}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {msg.text ?? `[${msg.kind}: conteúdo não coletado]`}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3 rounded-2xl border p-4">
        <h3 className="font-medium">Interpretações da IA</h3>
        <p className="text-xs">
          A IA usa até 40 mensagens recentes de texto, com até 1.500 caracteres
          de cada uma. Revise os achados antes de tomar decisões. Podem conter
          erros; não representam avaliação definitiva do profissional.
        </p>
        {!data?.analyses.length && (
          <p className="text-sm text-[var(--muted-foreground)]">
            Nenhuma análise autorizada com evidências no período selecionado.
          </p>
        )}
        {data?.analyses.map((a, i) => (
          <article key={i} className="space-y-2 border-t pt-3">
            <p className="text-xs">
              Análise em {new Date(a.generated_at).toLocaleString("pt-BR")}
            </p>
            {a.findings.map((f, j) => (
              <div key={j}>
                <p className="text-sm">
                  <strong>
                    {{
                      objection: "Objeção",
                      intent: "Intenção",
                      service: "Atendimento",
                    }[f.category] ?? f.category}
                    :
                  </strong>{" "}
                  {f.label}
                </p>
                {!clientId && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Evidências: {f.evidence_ids?.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
