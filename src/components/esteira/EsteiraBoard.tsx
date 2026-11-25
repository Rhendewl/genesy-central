"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useEsteira } from "@/hooks/useEsteira";
import { AGENTES_INFO, colunasDoAgente, indicadores, tempoRelativo } from "@/lib/esteira/board";
import type { EsteiraAgente, EsteiraAprendizado, EsteiraItem } from "@/types/esteira";

type Filtro = "todos" | EsteiraAgente;

const LARANJA = "#fe7b4a";
const VERDE = "#22c55e";

const caixa: React.CSSProperties = {
  background: "var(--glass-bg-soft)",
  border: "1px solid var(--glass-border)",
  borderRadius: 20,
};

export function EsteiraBoard() {
  const esteira = useEsteira(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const kpi = useMemo(() => indicadores(esteira.itens, esteira.agora), [esteira.itens, esteira.agora]);
  const agentes = (["alfred", "bruce"] as EsteiraAgente[]).filter((a) => filtro === "todos" || filtro === a);
  const regras = esteira.aprendizados.filter((a) => a.tipo === "regra").slice(0, 6);
  const propostas = esteira.aprendizados.filter((a) => a.tipo === "proposta" && a.status === "pendente");

  if (esteira.isLoading) return <div className="lc-card h-72 animate-pulse" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
          style={{ color: esteira.conectado ? "#b7f5c9" : "var(--text-body)", background: esteira.conectado ? "rgba(34,197,94,0.1)" : "var(--hover)", border: `1px solid ${esteira.conectado ? "rgba(34,197,94,0.35)" : "var(--glass-border)"}` }}
        >
          <span className={esteira.conectado ? "esteira-vivo h-2 w-2 rounded-full" : "h-2 w-2 rounded-full"} style={{ background: esteira.conectado ? VERDE : "var(--text-muted)" }} />
          {esteira.conectado ? "Ao vivo" : "Reconectando…"}
        </span>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Filtrar por agente" className="flex gap-1 rounded-xl p-1" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
            {(["todos", "alfred", "bruce"] as Filtro[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => setFiltro(f)}
                className="h-9 rounded-lg px-3 text-xs font-semibold transition"
                style={filtro === f ? { background: "var(--text-title)", color: "var(--background)" } : { color: "var(--text-subtitle)" }}
              >
                {f === "todos" ? "Todos" : AGENTES_INFO[f].nome.split(" ")[0]}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void esteira.recarregar()} aria-label="Atualizar" className="grid h-9 w-9 place-items-center rounded-xl transition hover:bg-[var(--hover)]" style={{ border: "1px solid var(--glass-border)", color: "var(--text-subtitle)" }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {esteira.error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}>{esteira.error}</div>
      )}

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador destaque titulo="Esperando você" valor={String(kpi.esperando)} sub="aprovações paradas na esteira" />
        <Indicador titulo="Em produção agora" valor={String(kpi.produzindo)} sub="agentes trabalhando" />
        <Indicador titulo="Entregues hoje" valor={String(kpi.entreguesHoje)} sub="no ar ou concluídos" />
        <Indicador titulo="Do pedido à entrega" valor={kpi.tempoMedio ?? "—"} sub="média dos últimos 7 dias" />
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Esteira por agente" className="min-w-0 space-y-4" style={{ flex: "999 1 640px" }}>
          {agentes.map((agente) => (
            <LinhaAgente key={agente} agente={agente} itens={esteira.itens} agora={esteira.agora} decidir={esteira.decidirItem} />
          ))}
        </section>

        <aside className="min-w-0 space-y-4" style={{ flex: "1 1 300px" }}>
          <section aria-label="Acontecendo agora" className="space-y-3 p-4" style={caixa}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Acontecendo agora</h2>
            {esteira.eventos.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-body)" }}>Assim que o Alfred ou o Bruce começarem um trabalho, os passos aparecem aqui.</p>
            ) : (
              <ol className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {esteira.eventos.map((ev) => (
                  <li key={ev.id} className="flex gap-2.5">
                    <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: corEvento(ev.tipo, ev.agente) }} />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug" style={{ color: "var(--text-subtitle)" }}>{ev.texto}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-body)" }}>{tempoRelativo(ev.created_at, esteira.agora)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-label="Aprendizados" className="space-y-3 p-4" style={caixa}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>O que eles aprenderam</h2>
              <span className="text-[11px]" style={{ color: "var(--text-body)" }}>últimos 14 dias</span>
            </div>
            {propostas.map((p) => <Proposta key={p.id} proposta={p} decidir={esteira.decidirProposta} />)}
            {regras.length === 0 && propostas.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-body)" }}>Quando você responder “salva” a uma regra no Telegram, ela aparece aqui.</p>
            )}
            {regras.map((r) => (
              <div key={r.id} className="space-y-1 rounded-xl p-3" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
                <p className="text-[11px]" style={{ color: AGENTES_INFO[r.agente].cor }}>{AGENTES_INFO[r.agente].nome.split(" ")[0]}{r.escopo ? ` · ${r.escopo}` : ""}</p>
                <p className="text-[13px] leading-snug" style={{ color: "var(--text-subtitle)" }}>{r.texto}</p>
                <p className="text-[11px]" style={{ color: "var(--text-body)" }}>{tempoRelativo(r.created_at, esteira.agora)}</p>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}

function corEvento(tipo: string, agente: EsteiraAgente | null) {
  if (tipo === "decisao" || tipo === "proposta") return LARANJA;
  if (tipo === "passo") return VERDE;
  return agente ? AGENTES_INFO[agente].cor : "var(--text-muted)";
}

function Indicador({ titulo, valor, sub, destaque = false }: { titulo: string; valor: string; sub: string; destaque?: boolean }) {
  return (
    <div
      className="space-y-1 rounded-2xl px-4 py-3.5"
      style={destaque
        ? { background: "rgba(254,123,74,0.08)", border: "1px solid rgba(254,123,74,0.4)" }
        : { background: "var(--glass-bg-soft)", border: "1px solid var(--glass-border)" }}
    >
      <p className="text-xs" style={{ color: destaque ? "#ffc4ad" : "var(--text-body)" }}>{titulo}</p>
      <p className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-title)" }}>{valor}</p>
      <p className="text-[11px]" style={{ color: "var(--text-body)" }}>{sub}</p>
    </div>
  );
}

function LinhaAgente({ agente, itens, agora, decidir }: {
  agente: EsteiraAgente;
  itens: EsteiraItem[];
  agora: number;
  decidir: (id: string, decisao: "aprovado" | "ajuste", nota?: string) => Promise<void>;
}) {
  const info = AGENTES_INFO[agente];
  const colunas = colunasDoAgente(itens, agente);
  const ativos = colunas.filter((c) => c.etapa === "produzindo").reduce((s, c) => s + c.itens.length, 0);
  const esperando = colunas.find((c) => c.etapa === "esperando")?.itens.length ?? 0;
  const status = esperando > 0
    ? `${esperando} ${esperando === 1 ? "item esperando" : "itens esperando"} você`
    : ativos > 0 ? `trabalhando em ${ativos} ${ativos === 1 ? "item" : "itens"}` : "livre";

  return (
    <div className="space-y-3.5 p-4" style={caixa}>
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 flex-none place-items-center rounded-xl text-base font-bold" style={{ background: info.cor, color: "#000" }} aria-hidden="true">{info.inicial}</div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold" style={{ color: "var(--text-title)" }}>{info.nome}</p>
          <p className="truncate text-xs" style={{ color: "var(--text-body)" }}>{info.papel}</p>
        </div>
        <p className="ml-auto text-xs" style={{ color: esperando > 0 ? "#ffc4ad" : "var(--text-body)" }}>{status}</p>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[920px] grid-cols-5 gap-2.5">
          {colunas.map((col) => {
            const espera = col.etapa === "esperando";
            return (
              <div
                key={col.etapa}
                className="flex min-h-[150px] flex-col gap-2 rounded-2xl p-2"
                style={espera
                  ? { background: "rgba(254,123,74,0.06)", border: "1px solid rgba(254,123,74,0.35)" }
                  : { background: "var(--hover)", border: "1px dashed var(--glass-border)" }}
              >
                <div className="flex items-center justify-between px-1 pb-1 pt-0.5">
                  <span className="text-xs font-semibold" style={{ color: espera ? "#ffc4ad" : "var(--text-subtitle)" }}>{col.label}</span>
                  <span className="text-[11px]" style={{ color: "var(--text-body)" }}>{col.itens.length}</span>
                </div>
                {col.itens.map((item) => (
                  <CardItem key={item.id} item={item} cor={info.cor} agora={agora} decidir={decidir} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CardItem({ item, cor, agora, decidir }: {
  item: EsteiraItem;
  cor: string;
  agora: number;
  decidir: (id: string, decisao: "aprovado" | "ajuste", nota?: string) => Promise<void>;
}) {
  const [modo, setModo] = useState<"normal" | "ajuste">("normal");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vivo = item.etapa === "produzindo";
  const espera = item.etapa === "esperando";
  const aguardandoAgente = item.decisao !== null && item.decisao_entregue_em === null;

  async function enviar(decisao: "aprovado" | "ajuste") {
    setEnviando(true); setErro(null);
    try {
      await decidir(item.id, decisao, decisao === "ajuste" ? nota : undefined);
      setModo("normal"); setNota("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article
      className="flex flex-col gap-1.5 rounded-xl p-3"
      style={{
        background: "var(--popover)",
        border: `1px solid ${vivo ? "rgba(34,197,94,0.45)" : espera ? "rgba(254,123,74,0.45)" : "var(--glass-border)"}`,
        borderTop: `3px solid ${cor}`,
      }}
    >
      <div className="flex justify-between gap-2 text-[11px]" style={{ color: "var(--text-body)" }}>
        <span className="truncate">{item.cliente ?? "—"}</span>
        <span className="flex-none">{tempoRelativo(item.etapa_desde, agora)}</span>
      </div>
      <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--text-title)" }}>{item.titulo}</p>
      {item.detalhe && <p className="text-xs leading-snug" style={{ color: "var(--text-body)" }}>{item.detalhe}</p>}

      {vivo && (
        <div className="space-y-1.5 pt-0.5">
          {item.progresso !== null && (
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--hover)" }}>
              <div className="esteira-fita h-full rounded-full" style={{ width: `${item.progresso}%`, backgroundColor: VERDE }} />
            </div>
          )}
          {item.passo_atual && (
            <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "#86efac" }}>
              <span className="esteira-vivo h-1.5 w-1.5 flex-none rounded-full" style={{ background: VERDE }} />
              {item.passo_atual}
            </p>
          )}
        </div>
      )}

      {!vivo && aguardandoAgente && (
        <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-body)" }}>
          <Loader2 size={11} className="animate-spin" /> Avisando o agente…
        </p>
      )}

      {item.links.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
          {item.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--accent-blue)" }}>
              {l.label} <ExternalLink size={10} />
            </a>
          ))}
        </div>
      )}

      {espera && modo === "normal" && (
        <div className="flex gap-1.5 pt-1">
          <button type="button" disabled={enviando} onClick={() => void enviar("aprovado")} className="h-9 flex-1 rounded-lg text-xs font-bold disabled:opacity-60" style={{ background: LARANJA, color: "#1a0a03" }}>
            {enviando ? "Enviando…" : "Aprovar"}
          </button>
          <button type="button" disabled={enviando} onClick={() => setModo("ajuste")} className="h-9 flex-1 rounded-lg text-xs font-semibold" style={{ border: "1px solid var(--glass-border)", color: "var(--text-title)" }}>
            Ajustar
          </button>
        </div>
      )}

      {espera && modo === "ajuste" && (
        <div className="space-y-1.5 pt-1">
          <label className="sr-only" htmlFor={`ajuste-${item.id}`}>O que precisa mudar</label>
          <textarea
            id={`ajuste-${item.id}`}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="O que precisa mudar?"
            className="editor-input h-auto w-full resize-none py-2"
          />
          <div className="flex gap-1.5">
            <button type="button" disabled={enviando || !nota.trim()} onClick={() => void enviar("ajuste")} className="h-9 flex-1 rounded-lg text-xs font-bold disabled:opacity-60" style={{ background: "var(--text-title)", color: "var(--background)" }}>
              {enviando ? "Enviando…" : "Pedir ajuste"}
            </button>
            <button type="button" disabled={enviando} onClick={() => { setModo("normal"); setNota(""); }} className="h-9 rounded-lg px-3 text-xs" style={{ color: "var(--text-body)" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {erro && <p className="text-[11px]" style={{ color: "#fca5a5" }}>{erro}</p>}
    </article>
  );
}

function Proposta({ proposta, decidir }: { proposta: EsteiraAprendizado; decidir: (id: string, d: "aceita" | "descartada") => Promise<void> }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function enviar(d: "aceita" | "descartada") {
    setEnviando(true); setErro(null);
    try { await decidir(proposta.id, d); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível enviar."); } finally { setEnviando(false); }
  }
  const info = AGENTES_INFO[proposta.agente];
  return (
    <div className="space-y-2 rounded-xl p-3" style={{ background: "rgba(254,123,74,0.06)", border: "1px dashed rgba(254,123,74,0.45)" }}>
      <p className="text-[11px]" style={{ color: "#ffc4ad" }}>Proposta do {info.nome.split(" ")[0]}{proposta.escopo ? ` · ${proposta.escopo}` : ""}</p>
      <p className="text-[13px] leading-snug" style={{ color: "var(--text-subtitle)" }}>{proposta.texto}</p>
      <div className="flex gap-1.5">
        <button type="button" disabled={enviando} onClick={() => void enviar("aceita")} className="h-8 rounded-lg px-3 text-xs font-bold disabled:opacity-60" style={{ background: "var(--text-title)", color: "var(--background)" }}>Salvar regra</button>
        <button type="button" disabled={enviando} onClick={() => void enviar("descartada")} className="h-8 rounded-lg px-3 text-xs" style={{ border: "1px solid var(--glass-border)", color: "var(--text-title)" }}>Descartar</button>
      </div>
      {erro && <p className="text-[11px]" style={{ color: "#fca5a5" }}>{erro}</p>}
    </div>
  );
}
