"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity, Bot, Check, CheckCircle2, Cpu, ExternalLink, Hourglass, Inbox, Lightbulb, Loader2, PenLine, RefreshCw, Rocket, Sparkles, Timer,
} from "lucide-react";
import { useEsteira } from "@/hooks/useEsteira";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";
import { accentBorderStyle } from "@/components/ui/accent-border";
import "@/components/workspace/workspace-kanban.css";
import { AGENTES_INFO, colunasDoAgente, indicadores, tempoRelativo } from "@/lib/esteira/board";
import type { EsteiraAgente, EsteiraAprendizado, EsteiraEtapa, EsteiraEvento, EsteiraItem } from "@/types/esteira";

/* ─────────────────────────── Estilo ─────────────────────────── */

type Filtro = "todos" | EsteiraAgente;
type Decidir = (id: string, decisao: "aprovado" | "ajuste", nota?: string) => Promise<void>;

const AGENTES: EsteiraAgente[] = ["alfred", "bruce"];
const VERDE = "#22c55e";
const LARANJA = "#fb923c";
const BTN_GREEN = "linear-gradient(135deg, #059669, #10b981 55%, #34d399)";
const BTN_ORANGE = "linear-gradient(135deg, #ea580c, #f97316 55%, #fb923c)";
const CINZA: [string, string] = ["#9ca3af", "#6b7280"];
/** Contorno branco em gradiente das fotos dos agentes. */
const ANEL = "linear-gradient(145deg, #ffffff, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0.12))";
const title = { color: "var(--text-title)" } as const;
const muted = { color: "var(--text-body)" } as const;
const subtle = { color: "var(--text-subtitle)" } as const;
// Cores de texto com variante para o tema claro (os tons claros somem no fundo branco).
const TXT = {
  verde: "text-emerald-300 [.light_&]:text-emerald-700",
  laranja: "text-orange-300 [.light_&]:text-orange-700",
  ceu: "text-sky-300 [.light_&]:text-sky-700",
} as const;
const AG_TXT: Record<EsteiraAgente, string> = {
  alfred: "text-sky-400 [.light_&]:text-sky-700",
  bruce: "text-teal-300 [.light_&]:text-teal-700",
};

const grad = (agente: EsteiraAgente, angle = 135) => {
  const [a, b] = AGENTES_INFO[agente].gradiente;
  return `linear-gradient(${angle}deg, ${a}, ${b})`;
};
const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

/** Ícone e cor de cada etapa da esteira. */
const ETAPA_UI: Record<EsteiraEtapa, { icon: ReactNode; cor: string }> = {
  pedido: { icon: <Inbox size={13} />, cor: "#9ca3af" },
  produzindo: { icon: <Cpu size={13} />, cor: VERDE },
  esperando: { icon: <Hourglass size={13} />, cor: LARANJA },
  aprovado: { icon: <Check size={13} />, cor: "#a78bfa" },
  no_ar: { icon: <Rocket size={13} />, cor: "#27a3ff" },
  concluido: { icon: <CheckCircle2 size={13} />, cor: "#38bdf8" },
  cancelado: { icon: <Check size={13} />, cor: "#64748b" },
};

function Glow({ spots }: { spots: Array<{ color: string; className: string; opacity: number }> }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: "inherit" }}>
      {spots.map((spot, index) => (
        <div key={index} className={`absolute rounded-full ${spot.className}`} style={{ background: `radial-gradient(circle, ${spot.color} 0%, transparent 68%)`, opacity: spot.opacity }} />
      ))}
    </div>
  );
}

function Avatar({ agente, size = 40, ring, className = "" }: { agente: EsteiraAgente; size?: number; ring?: "vivo" | "espera" | "livre"; className?: string }) {
  const info = AGENTES_INFO[agente];
  const ponto = ring === "vivo" ? VERDE : ring === "espera" ? LARANJA : "#64748b";
  return (
    <span className={`relative inline-flex flex-none ${className}`} style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full p-[2px] [.light_&]:shadow-[0_0_0_1px_rgba(0,0,0,0.1)]"
        style={{ background: ANEL }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={info.foto} alt={info.nome} width={size} height={size} className="h-full w-full rounded-full object-cover" style={{ background: "#0b0b0c" }} />
      </span>
      {ring && (
        <span
          aria-hidden
          className={`absolute bottom-0 right-0 rounded-full ${ring === "vivo" ? "esteira-vivo" : ""}`}
          style={{ width: Math.max(9, size * 0.24), height: Math.max(9, size * 0.24), background: ponto, border: "2px solid var(--background, #000)" }}
        />
      )}
    </span>
  );
}

/* ─────────────────────────── Painel ─────────────────────────── */

export function AgentesBoard() {
  const esteira = useEsteira(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const agentes = AGENTES.filter((a) => filtro === "todos" || filtro === a);
  const itens = useMemo(() => esteira.itens.filter((i) => filtro === "todos" || i.agente === filtro), [esteira.itens, filtro]);
  const kpi = useMemo(() => indicadores(itens, esteira.agora), [itens, esteira.agora]);
  const eventos = esteira.eventos.filter((e) => filtro === "todos" || e.agente === filtro || e.agente === null);
  const aprendizados = esteira.aprendizados.filter((a) => filtro === "todos" || a.agente === filtro);
  const regras = aprendizados.filter((a) => a.tipo === "regra").slice(0, 6);
  const propostas = aprendizados.filter((a) => a.tipo === "proposta" && a.status === "pendente");

  if (esteira.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2"><div className="lc-card h-44 animate-pulse" /><div className="lc-card h-44 animate-pulse" /></div>
        <div className="lc-card h-72 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AoVivo conectado={esteira.conectado} />
        <div className="flex items-center gap-2">
          <FiltroAgentes value={filtro} onChange={setFiltro} />
          <button
            type="button"
            onClick={() => void esteira.recarregar()}
            aria-label="Atualizar"
            className="lc-card grid h-11 w-11 place-items-center !rounded-xl transition hover:text-emerald-400"
            style={subtle}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {esteira.error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}>{esteira.error}</div>
      )}

      <section aria-label="Agentes" className={`grid gap-4 ${agentes.length > 1 ? "md:grid-cols-2" : ""}`}>
        {agentes.map((agente) => <CartaoAgente key={agente} agente={agente} itens={esteira.itens} agora={esteira.agora} />)}
      </section>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi destaque={kpi.esperando > 0} icon={<Hourglass size={16} />} cor={LARANJA} titulo="Esperando você" valor={String(kpi.esperando)} sub="aprovações paradas" />
        <Kpi icon={<Cpu size={16} />} cor={VERDE} titulo="Em produção agora" valor={String(kpi.produzindo)} sub="agentes trabalhando" />
        <Kpi icon={<Rocket size={16} />} cor="#38bdf8" titulo="Entregues hoje" valor={String(kpi.entreguesHoje)} sub="no ar ou concluídos" />
        <Kpi icon={<Timer size={16} />} cor="#a78bfa" titulo="Do pedido à entrega" valor={kpi.tempoMedio ?? "—"} sub="média dos últimos 7 dias" />
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Esteira por agente" className="min-w-0 space-y-4" style={{ flex: "999 1 640px" }}>
          {agentes.map((agente) => (
            <Esteira key={agente} agente={agente} itens={esteira.itens} agora={esteira.agora} decidir={esteira.decidirItem} />
          ))}
        </section>

        <aside className="min-w-0 space-y-4" style={{ flex: "1 1 300px" }}>
          <Painel icon={<Activity size={15} />} cor={VERDE} titulo="Acontecendo agora">
            {eventos.length === 0 ? (
              <Vazio texto="Assim que o Alfred ou o Bruce começarem um trabalho, os passos aparecem aqui." />
            ) : (
              <ol className="relative max-h-[440px] space-y-3.5 overflow-y-auto pr-1">
                <span aria-hidden className="absolute bottom-2 left-[11px] top-2 w-px" style={{ background: "var(--glass-border)" }} />
                {eventos.map((ev) => <LinhaEvento key={ev.id} evento={ev} agora={esteira.agora} />)}
              </ol>
            )}
          </Painel>

          <Painel icon={<Lightbulb size={15} />} cor="#facc15" titulo="O que eles aprenderam" extra="últimos 14 dias">
            {propostas.map((p) => <Proposta key={p.id} proposta={p} decidir={esteira.decidirProposta} />)}
            {regras.length === 0 && propostas.length === 0 && (
              <Vazio texto="Quando você responder “salva” a uma regra no Telegram, ela aparece aqui." />
            )}
            {regras.map((r) => (
              <div key={r.id} className="flex gap-2.5 rounded-xl p-3" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
                <Avatar agente={r.agente} size={26} />
                <div className="min-w-0 space-y-1">
                  <p className={`text-[11px] font-semibold ${AG_TXT[r.agente]}`}>
                    {AGENTES_INFO[r.agente].nome.split(" ")[0]}<span className="font-normal" style={muted}>{r.escopo ? ` · ${r.escopo}` : ""} · {tempoRelativo(r.created_at, esteira.agora)}</span>
                  </p>
                  <p className="text-[13px] leading-snug" style={subtle}>{r.texto}</p>
                </div>
              </div>
            ))}
          </Painel>
        </aside>
      </div>
    </div>
  );
}

/* ─────────────────────────── Topo ─────────────────────────── */

function AoVivo({ conectado }: { conectado: boolean }) {
  return (
    <span
      className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-semibold ${conectado ? TXT.verde : ""}`}
      style={conectado
        ? { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.35)", boxShadow: "0 0 24px rgba(34,197,94,0.12)" }
        : { ...muted, background: "var(--hover)", border: "1px solid var(--glass-border)" }}
    >
      <span className={conectado ? "esteira-vivo h-2 w-2 rounded-full" : "h-2 w-2 rounded-full"} style={{ background: conectado ? VERDE : "var(--text-muted)" }} />
      {conectado ? "Ao vivo" : "Reconectando…"}
    </span>
  );
}

function FiltroAgentes({ value, onChange }: { value: Filtro; onChange: (f: Filtro) => void }) {
  const seg = useSegmentIndicator({ background: "linear-gradient(180deg, #ffffff, #e9ebee)", boxShadow: "0 6px 18px rgba(255,255,255,.22), 0 1px 3px rgba(0,0,0,.18)" });
  const opcoes: Filtro[] = ["todos", ...AGENTES];
  return (
    <div ref={seg.trackRef} role="group" aria-label="Filtrar por agente" className="lc-card relative flex h-11 items-center gap-0.5 !rounded-xl p-1">
      {seg.indicator}
      {opcoes.map((f) => {
        const ativo = value === f;
        return (
          <button
            key={f}
            type="button"
            aria-pressed={ativo}
            data-active={ativo}
            onClick={() => onChange(f)}
            className="relative z-[1] flex h-full items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-300 sm:px-3"
            style={{ color: ativo ? "#0b0b0c" : "var(--text-subtitle)" }}
          >
            {f === "todos" ? <Bot size={15} /> : <Avatar agente={f} size={22} />}
            <span className={f === "todos" ? "" : "hidden sm:inline"}>{f === "todos" ? "Todos" : AGENTES_INFO[f].nome.split(" ")[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Cartões ─────────────────────────── */

function statusDoAgente(itens: EsteiraItem[], agente: EsteiraAgente) {
  const doAgente = itens.filter((i) => i.agente === agente);
  const produzindo = doAgente.filter((i) => i.etapa === "produzindo");
  const esperando = doAgente.filter((i) => i.etapa === "esperando").length;
  const ring: "vivo" | "espera" | "livre" = esperando > 0 ? "espera" : produzindo.length > 0 ? "vivo" : "livre";
  const texto = esperando > 0
    ? `${esperando} ${esperando === 1 ? "item esperando" : "itens esperando"} você`
    : produzindo.length > 0 ? `Trabalhando em ${produzindo.length} ${produzindo.length === 1 ? "item" : "itens"}` : "Livre";
  return { produzindo, esperando, ring, texto };
}

function CartaoAgente({ agente, itens, agora }: { agente: EsteiraAgente; itens: EsteiraItem[]; agora: number }) {
  const info = AGENTES_INFO[agente];
  const status = statusDoAgente(itens, agente);
  const kpi = indicadores(itens.filter((i) => i.agente === agente), agora);
  const atual = status.produzindo[0];
  const corStatus = status.ring === "espera" ? LARANJA : status.ring === "vivo" ? VERDE : "#94a3b8";
  const txtStatus = status.ring === "espera" ? "text-orange-400 [.light_&]:text-orange-600" : status.ring === "vivo" ? "text-emerald-400 [.light_&]:text-emerald-600" : "text-slate-400 [.light_&]:text-slate-500";
  return (
    <article className="lc-card relative overflow-hidden p-4 sm:p-5">
      <Glow spots={[
        { color: CINZA[0], className: "-right-24 -top-28 h-72 w-72", opacity: 0.2 },
        { color: CINZA[1], className: "-bottom-32 -left-20 h-64 w-64", opacity: 0.12 },
      ]} />
      <div className="relative flex items-center gap-4">
        <Avatar agente={agente} size={68} ring={status.ring} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight" style={title}>{info.nome}</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white/80 [.light_&]:border-black/10 [.light_&]:bg-black/5 [.light_&]:text-black/60">
              <Bot size={10} /> Agente IA
            </span>
          </div>
          <p className="truncate text-xs" style={muted}>{info.papel}</p>
          <p className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold ${txtStatus}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.ring === "vivo" ? "esteira-vivo" : ""}`} style={{ background: corStatus }} />
            {status.texto}
          </p>
        </div>
      </div>

      <div className="relative mt-4 rounded-xl px-3 py-2.5" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
        {atual ? (
          <div className="space-y-1.5">
            <p className={`flex items-center gap-1.5 text-[11px] font-medium ${TXT.verde}`}>
              <Sparkles size={12} /> Agora: <span className="truncate" style={subtle}>{atual.passo_atual ?? atual.titulo}</span>
            </p>
            <Progresso valor={atual.progresso} agente={agente} />
          </div>
        ) : (
          <p className="text-[11px]" style={muted}>{status.esperando > 0 ? "Parado esperando a sua aprovação." : "Sem trabalho em andamento. Pronto para o próximo pedido."}</p>
        )}
      </div>

      <dl className="relative mt-3 grid grid-cols-3 gap-2">
        {[
          { rotulo: "Produzindo", valor: kpi.produzindo, cor: VERDE },
          { rotulo: "Esperando", valor: kpi.esperando, cor: LARANJA },
          { rotulo: "Entregues", valor: kpi.entreguesHoje, cor: "#38bdf8" },
        ].map((m) => (
          <div key={m.rotulo} className="rounded-xl px-3 py-2" style={{ background: alpha(m.cor, 0.07), border: `1px solid ${alpha(m.cor, 0.2)}` }}>
            <dt className="truncate text-[10px] font-medium uppercase tracking-wide" style={muted}>{m.rotulo}</dt>
            <dd className="text-xl font-semibold tabular-nums" style={title}>{m.valor}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function Kpi({ icon, cor, titulo, valor, sub, destaque = false }: { icon: ReactNode; cor: string; titulo: string; valor: string; sub: string; destaque?: boolean }) {
  return (
    <div className="lc-card relative min-w-0 overflow-hidden p-3.5 sm:p-4" style={destaque ? { borderColor: alpha(cor, 0.5), boxShadow: `0 0 0 1px ${alpha(cor, 0.25)}, 0 10px 40px ${alpha(cor, 0.18)}` } : undefined}>
      <Glow spots={[{ color: cor, className: "-right-14 -top-16 h-40 w-40", opacity: destaque ? 0.35 : 0.16 }]} />
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-xs font-medium" style={subtle}>{titulo}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: `linear-gradient(135deg, ${alpha(cor, 0.95)}, ${alpha(cor, 0.55)})`, boxShadow: `0 4px 14px ${alpha(cor, 0.35)}` }}>{icon}</span>
      </div>
      <strong className="relative mt-2 block text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl" style={title}>{valor}</strong>
      <p className="relative mt-0.5 text-[11px]" style={muted}>{sub}</p>
    </div>
  );
}

function Progresso({ valor, agente }: { valor: number | null; agente: EsteiraAgente }) {
  if (valor === null) return null;
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--hover)" }} role="progressbar" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={100}>
      <div className="esteira-fita h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${valor}%`, backgroundColor: AGENTES_INFO[agente].cor, backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,.22) 0 6px, transparent 6px 12px), ${grad(agente, 90)}` }} />
    </div>
  );
}

/* ─────────────────────────── Esteira ─────────────────────────── */

function Esteira({ agente, itens, agora, decidir }: { agente: EsteiraAgente; itens: EsteiraItem[]; agora: number; decidir: Decidir }) {
  const info = AGENTES_INFO[agente];
  const colunas = colunasDoAgente(itens, agente);
  const status = statusDoAgente(itens, agente);
  const total = colunas.reduce((s, c) => s + c.itens.length, 0);
  return (
    <div className="lc-card relative overflow-hidden p-4">
      <Glow spots={[{ color: CINZA[0], className: "-left-24 -top-32 h-72 w-72", opacity: 0.1 }]} />
      <div className="relative mb-3.5 flex items-center gap-3">
        <Avatar agente={agente} size={36} ring={status.ring} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold" style={title}>Esteira do {info.nome.split(" ")[0]}</p>
          <p className="text-xs" style={muted}>{total} {total === 1 ? "trabalho" : "trabalhos"} na esteira</p>
        </div>
      </div>
      <div className="relative overflow-x-auto pb-1">
        <div className="grid min-w-[940px] grid-cols-5 gap-2.5">
          {colunas.map((col) => {
            const ui = ETAPA_UI[col.etapa];
            const espera = col.etapa === "esperando" && col.itens.length > 0;
            return (
              <div
                key={col.etapa}
                className="workspace-stage-column app-accent-border flex min-h-[200px] flex-col gap-2 rounded-[20px] p-2.5 transition-all duration-200"
                style={{
                  background: "var(--glass-bg-soft)",
                  backdropFilter: "blur(14px) saturate(140%)",
                  border: "1px solid var(--border-card)",
                  ...accentBorderStyle(ui.cor),
                  boxShadow: espera ? `0 8px 28px ${alpha(ui.cor, 0.16)}, inset 0 1px 0 rgba(255,255,255,0.06)` : "0 4px 20px var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <div className="flex items-center gap-1.5 px-0.5 pb-1.5 pt-1">
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-lg" style={{ background: alpha(ui.cor, 0.16), border: `1px solid ${alpha(ui.cor, 0.22)}`, boxShadow: `0 8px 22px ${alpha(ui.cor, 0.16)}`, color: ui.cor }}>{ui.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-card-secondary)" }}>{col.label}</span>
                  <span className="min-w-[20px] flex-none rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums" style={{ background: alpha(ui.cor, 0.16), color: ui.cor }}>{col.itens.length}</span>
                </div>
                {col.itens.length === 0 && <span className="m-auto text-[11px]" style={{ color: "var(--text-muted)" }}>—</span>}
                {col.itens.map((item) => <CardItem key={item.id} item={item} agente={agente} agora={agora} decidir={decidir} />)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CardItem({ item, agente, agora, decidir }: { item: EsteiraItem; agente: EsteiraAgente; agora: number; decidir: Decidir }) {
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
      className="group relative flex flex-col gap-1.5 overflow-hidden rounded-xl p-3 pl-3.5 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        border: `1px solid ${vivo ? "rgba(34,197,94,0.45)" : espera ? "rgba(251,146,60,0.5)" : "var(--glass-border)"}`,
        boxShadow: vivo ? "0 0 22px rgba(34,197,94,0.14)" : espera ? "0 0 22px rgba(251,146,60,0.16)" : "0 4px 18px rgba(0,0,0,0.18)",
      }}
    >
      <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[linear-gradient(180deg,#ffffff,rgba(255,255,255,0.12))] [.light_&]:bg-[linear-gradient(180deg,#9ca3af,rgba(156,163,175,0.15))]" />
      <div className="flex justify-between gap-2 text-[11px]" style={muted}>
        <span className={`truncate font-medium ${AG_TXT[agente]}`}>{item.cliente ?? "—"}</span>
        <span className="flex-none">{tempoRelativo(item.etapa_desde, agora)}</span>
      </div>
      <p className="text-[13px] font-semibold leading-snug" style={title}>{item.titulo}</p>
      {item.detalhe && <p className="line-clamp-3 text-xs leading-snug" style={muted}>{item.detalhe}</p>}

      {vivo && (
        <div className="space-y-1.5 pt-0.5">
          <Progresso valor={item.progresso} agente={agente} />
          {item.passo_atual && (
            <p className={`flex items-center gap-1.5 text-[11px] ${TXT.verde}`}>
              <span className="esteira-vivo h-1.5 w-1.5 flex-none rounded-full" style={{ background: VERDE }} />
              {item.passo_atual}
            </p>
          )}
        </div>
      )}

      {!vivo && aguardandoAgente && (
        <p className="flex items-center gap-1.5 text-[11px]" style={muted}>
          <Loader2 size={11} className="animate-spin" /> Avisando o agente…
        </p>
      )}

      {item.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {item.links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition hover:brightness-125 ${TXT.ceu}`}
              style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)" }}
            >
              {l.label} <ExternalLink size={10} />
            </a>
          ))}
        </div>
      )}

      {espera && modo === "normal" && (
        <div className="flex gap-1.5 pt-1">
          <button type="button" disabled={enviando} onClick={() => void enviar("aprovado")} className="h-9 flex-1 rounded-lg text-xs font-bold text-white shadow-[0_6px_18px_rgba(249,115,22,.3)] transition hover:brightness-110 disabled:opacity-60" style={{ background: BTN_ORANGE }}>
            {enviando ? "Enviando…" : "Aprovar"}
          </button>
          <button type="button" disabled={enviando} onClick={() => setModo("ajuste")} className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg text-xs font-semibold transition hover:bg-white/5" style={{ border: "1px solid var(--glass-border)", color: "var(--text-title)" }}>
            <PenLine size={12} /> Ajustar
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
            <button type="button" disabled={enviando || !nota.trim()} onClick={() => void enviar("ajuste")} className="h-9 flex-1 rounded-lg text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50" style={{ background: grad(agente) }}>
              {enviando ? "Enviando…" : "Pedir ajuste"}
            </button>
            <button type="button" disabled={enviando} onClick={() => { setModo("normal"); setNota(""); }} className="h-9 rounded-lg px-3 text-xs" style={muted}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {erro && <p className="text-[11px]" style={{ color: "#fca5a5" }}>{erro}</p>}
    </article>
  );
}

/* ─────────────────────────── Lateral ─────────────────────────── */

function Painel({ icon, cor, titulo, extra, children }: { icon: ReactNode; cor: string; titulo: string; extra?: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="lc-card relative space-y-3 overflow-hidden p-4">
      <Glow spots={[{ color: cor, className: "-right-16 -top-20 h-44 w-44", opacity: 0.12 }]} />
      <div className="relative flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold" style={title}>
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: alpha(cor, 0.16), color: cor }}>{icon}</span>
          {titulo}
        </h2>
        {extra && <span className="whitespace-nowrap text-[11px]" style={muted}>{extra}</span>}
      </div>
      <div className="relative space-y-2.5">{children}</div>
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs" style={{ borderColor: "var(--glass-border)", color: "var(--text-muted)" }}>{texto}</p>;
}

function LinhaEvento({ evento, agora }: { evento: EsteiraEvento; agora: number }) {
  const destaque = evento.tipo === "decisao" || evento.tipo === "proposta" ? LARANJA : evento.tipo === "passo" ? VERDE : null;
  return (
    <li className="relative flex gap-2.5">
      {evento.agente ? (
        <Avatar agente={evento.agente} size={23} className="z-[1]" />
      ) : (
        <span className="z-[1] grid h-[23px] w-[23px] flex-none place-items-center rounded-full" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-subtitle)" }}><Bot size={12} /></span>
      )}
      <div className="min-w-0 pt-0.5">
        <p className="text-[13px] leading-snug" style={subtle}>
          {destaque && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px rounded-full align-middle" style={{ background: destaque }} />}
          {evento.texto}
        </p>
        <p className="text-[11px]" style={muted}>{evento.agente ? `${AGENTES_INFO[evento.agente].nome.split(" ")[0]} · ` : ""}{tempoRelativo(evento.created_at, agora)}</p>
      </div>
    </li>
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
    <div className="space-y-2 rounded-xl p-3" style={{ background: "linear-gradient(180deg, rgba(251,146,60,0.1), rgba(251,146,60,0.03))", border: "1px solid rgba(251,146,60,0.4)" }}>
      <div className="flex items-center gap-2">
        <Avatar agente={proposta.agente} size={24} />
        <p className={`text-[11px] font-semibold ${TXT.laranja}`}>Proposta do {info.nome.split(" ")[0]}{proposta.escopo ? ` · ${proposta.escopo}` : ""}</p>
      </div>
      <p className="text-[13px] leading-snug" style={subtle}>{proposta.texto}</p>
      <div className="flex gap-1.5">
        <button type="button" disabled={enviando} onClick={() => void enviar("aceita")} className="h-8 rounded-lg px-3 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-60" style={{ background: BTN_GREEN }}>Salvar regra</button>
        <button type="button" disabled={enviando} onClick={() => void enviar("descartada")} className="h-8 rounded-lg px-3 text-xs transition hover:bg-white/5" style={{ border: "1px solid var(--glass-border)", color: "var(--text-title)" }}>Descartar</button>
      </div>
      {erro && <p className="text-[11px]" style={{ color: "#fca5a5" }}>{erro}</p>}
    </div>
  );
}
