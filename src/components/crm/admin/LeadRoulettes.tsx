"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronLeft, Clock3, FileText, Layers, Pencil, Plus, RotateCw, Search, Shuffle, Trash2, Users, X } from "lucide-react";

/**
 * Roletas em ambientes (ex.: um por cliente). Cada ambiente tem filas de distribuição;
 * cada fila reúne formulários (Genesy e/ou Meta) e os corretores que recebem os leads, em sequência.
 */
type Participant = { profile_id: string; stage_id: string };
type Group = { id: string; name: string; created_at: string };
type Queue = { id: string; group_id: string | null; name: string; enabled: boolean; participants: Participant[]; cursor_position: number; created_at: string };
type Link = { roulette_id: string; source_kind: "genesy" | "meta"; form_id: string; page_id: string };
type Pipeline = { id: string; name: string; is_active: boolean; default_assignee_id: string | null; crm_stages: { id: string; name: string; is_active: boolean; order_index: number }[] };
type Profile = { id: string; full_name: string; avatar_url: string | null; role: string | null; is_active: boolean; auth_user_id: string | null; crm_pipeline_id: string | null };
type History = { id: string; roulette_id: string; status: string; lead_id: string | null; pipeline_id: string | null; assigned_to: string | null; form_id: string | null; created_at: string };
type Data = {
  groups: Group[]; queues: Queue[]; links: Link[];
  forms: { id: string; name: string }[];
  metaForms: { form_id: string; form_name: string | null; page_id: string; is_active: boolean }[];
  pipelines: Pipeline[]; history: History[]; profiles: Profile[];
  metaPages: { meta_page_id: string; page_name: string | null; is_active: boolean }[];
};
type MetaPageForms = { loading: boolean; error?: string; pageActive?: boolean; forms: { id: string; name: string; status: string }[] };
type FormRef = { source_kind: "genesy" | "meta"; form_id: string; page_id: string };
type QueueDraft = { id?: string; group_id: string; name: string; enabled: boolean; forms: FormRef[]; participants: Participant[] };

const button = "inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] px-3.5 py-2 text-sm transition-colors hover:bg-[var(--hover)] disabled:opacity-50";
const primary = "inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50";
const field = "w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] px-3 py-2.5 text-sm text-[var(--text-title)] outline-none focus:border-[var(--primary)]";
const formKey = (f: FormRef) => `${f.source_kind}:${f.page_id}:${f.form_id}`;
const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#f87171", "#2dd4bf", "#fb923c"];
const colorOf = (text: string) => COLORS[text.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];

function Avatar({ profile, size = 32, ring = false }: { profile?: Profile | null; size?: number; ring?: boolean }) {
  const name = profile?.full_name ?? "?";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");
  return <span title={name} className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 font-semibold text-white ${ring ? "border-[var(--primary)]" : "border-[var(--background)]"}`}
    style={{ width: size, height: size, fontSize: size * 0.36, background: colorOf(name), boxShadow: ring ? "0 0 0 3px color-mix(in srgb, var(--primary) 25%, transparent)" : undefined }}>
    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
  </span>;
}

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}
    className="relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50" style={{ background: checked ? "var(--primary)" : "var(--border-card-hover)" }}>
    <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: checked ? "translateX(16px)" : "none" }} />
  </button>;
}

function SourceBadge({ kind }: { kind: "genesy" | "meta" }) {
  return <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${kind === "meta" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"}`}>{kind === "meta" ? "Meta" : "Genesy"}</span>;
}

export function LeadRoulettes() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<{ id?: string; name: string } | null>(null);
  const [draft, setDraft] = useState<QueueDraft | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "queue" | "group"; id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/crm/roletas", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar as roletas.");
    setData(result);
  }, []);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);

  async function act(body: Record<string, unknown>, success: string | ((result: Record<string, unknown>) => string)) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/crm/roletas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir.");
      setMessage(typeof success === "function" ? success(result) : success);
      await load();
      return result as Record<string, unknown>;
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir."); return null; }
    finally { setBusy(false); }
  }

  const profile = (id: string | null | undefined) => data?.profiles.find(p => p.id === id) ?? null;
  const stageInfo = (stageId: string) => {
    const pipeline = data?.pipelines.find(p => p.crm_stages.some(s => s.id === stageId));
    return { pipeline, stage: pipeline?.crm_stages.find(s => s.id === stageId) };
  };
  const formLabel = (link: FormRef) => link.source_kind === "genesy"
    ? data?.forms.find(f => f.id === link.form_id)?.name ?? "Formulário removido"
    : data?.metaForms.find(f => f.form_id === link.form_id && f.page_id === link.page_id)?.form_name ?? `Formulário ${link.form_id}`;
  const queuesOf = (groupId: string) => data?.queues.filter(q => q.group_id === groupId) ?? [];
  const linksOf = (queueId: string) => data?.links.filter(l => l.roulette_id === queueId) ?? [];
  const pendingOf = (queueId: string) => data?.history.filter(h => h.roulette_id === queueId && h.status === "pending").length ?? 0;
  const closeGroup = () => { if (!busy) { setOpenGroup(null); setDraft(null); setConfirm(null); } };

  if (!data) return <section className="px-4 pt-6 sm:px-6">{error ? <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p> : <p role="status">Carregando roletas…</p>}</section>;
  const group = data.groups.find(g => g.id === openGroup) ?? null;

  return <section className="space-y-5 px-4 pt-6 text-[var(--text-title)] sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Shuffle size={21} /> Roletas de leads</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">Crie um ambiente para cada cliente ou operação. Dentro dele, monte filas: cada fila junta formulários e entrega um lead por vez a cada corretor, em sequência.</p></div>
      <button className={primary} disabled={busy} onClick={() => setGroupName({ name: "" })}><Plus size={16} />Novo ambiente</button>
    </div>
    {error && !group && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    {message && !group && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm">{message}</p>}

    {groupName && !groupName.id && <form onSubmit={e => { e.preventDefault(); const current = groupName; void act({ action: "save_group", id: current.id, name: current.name }, current.id ? "Ambiente renomeado." : "Ambiente criado.").then(result => { if (result) { setGroupName(null); if (!current.id && typeof result.id === "string") setOpenGroup(result.id); } }); }}
      className="relative z-[60] flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] p-4">
      <label className="min-w-64 flex-1 space-y-1 text-sm"><span>{groupName.id ? "Novo nome do ambiente" : "Nome do ambiente (ex.: nome do cliente)"}</span><input autoFocus className={field} maxLength={120} value={groupName.name} onChange={e => setGroupName({ ...groupName, name: e.target.value })} /></label>
      <button className={primary} disabled={busy || !groupName.name.trim()} type="submit">{busy ? "Salvando…" : "Salvar"}</button>
      <button className={button} type="button" onClick={() => setGroupName(null)}>Cancelar</button>
    </form>}

    {!data.groups.length && !(groupName && !groupName.id) ? <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--glass-border)] p-12 text-center">
      <div className="mb-4 rounded-2xl bg-[var(--hover)] p-4"><Layers size={26} /></div>
      <h3 className="font-medium">Nenhum ambiente ainda</h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">Comece criando um ambiente, por exemplo com o nome do cliente. Depois você adiciona as filas, os formulários e os corretores.</p>
      <button className={`${primary} mt-5`} onClick={() => setGroupName({ name: "" })}><Plus size={16} />Criar primeiro ambiente</button>
    </div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.groups.map(g => {
      const queues = queuesOf(g.id);
      const forms = queues.reduce((sum, q) => sum + linksOf(q.id).length, 0);
      const agents = Array.from(new Set(queues.flatMap(q => q.participants.map(p => p.profile_id))));
      const pending = queues.reduce((sum, q) => sum + pendingOf(q.id), 0);
      const active = queues.filter(q => q.enabled).length;
      return <button key={g.id} type="button" onClick={() => { setOpenGroup(g.id); setError(""); setMessage(""); }}
        className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-lg">
        <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl" style={{ background: colorOf(g.name) }} />
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: colorOf(g.name) }}><Shuffle size={20} /></span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${active ? "bg-emerald-500/15 text-emerald-400" : "bg-[var(--hover)] text-[var(--muted-foreground)]"}`}>{active ? `${active} fila${active > 1 ? "s" : ""} ativa${active > 1 ? "s" : ""}` : "Sem filas ativas"}</span>
        </div>
        <h3 className="mt-4 truncate text-lg font-semibold">{g.name}</h3>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1"><Layers size={13} />{queues.length} fila{queues.length === 1 ? "" : "s"}</span>
          <span className="flex items-center gap-1"><FileText size={13} />{forms} formulário{forms === 1 ? "" : "s"}</span>
          <span className="flex items-center gap-1"><Users size={13} />{agents.length} corretor{agents.length === 1 ? "" : "es"}</span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex -space-x-2">{agents.slice(0, 6).map(id => <Avatar key={id} profile={profile(id)} size={28} />)}{agents.length > 6 && <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--background)] bg-[var(--hover)] text-[10px]">+{agents.length - 6}</span>}</div>
          {pending > 0 && <span className="flex items-center gap-1 text-xs text-amber-400"><Clock3 size={12} />{pending} pendente{pending > 1 ? "s" : ""}</span>}
        </div>
        <span className="mt-4 flex items-center gap-1 text-xs font-medium text-[var(--primary)] opacity-80 group-hover:opacity-100">Abrir ambiente <ArrowRight size={13} /></span>
      </button>;
    })}</div>}

    {group && <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 backdrop-blur-sm sm:p-6" onClick={closeGroup}>
      <div role="dialog" aria-label={`Ambiente ${group.name}`} onClick={e => e.stopPropagation()}
        className="relative flex w-full max-w-6xl flex-col overflow-hidden bg-[var(--background)] shadow-2xl sm:rounded-3xl sm:border sm:border-[var(--glass-border)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white" style={{ background: colorOf(group.name) }}><Shuffle size={18} /></span>
            <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Ambiente de roleta</p><h3 className="truncate text-lg font-semibold">{group.name}</h3></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={button} disabled={busy} onClick={() => setGroupName({ id: group.id, name: group.name })}><Pencil size={14} />Renomear</button>
            <button aria-label="Excluir ambiente" className={button} disabled={busy} onClick={() => setConfirm({ kind: "group", id: group.id, name: group.name })}><Trash2 size={14} /></button>
            {!draft && <button className={primary} disabled={busy} onClick={() => setDraft({ group_id: group.id, name: "", enabled: true, forms: [], participants: [] })}><Plus size={15} />Nova fila</button>}
            <button aria-label="Fechar" className="rounded-xl p-2 hover:bg-[var(--hover)]" onClick={closeGroup}><X size={18} /></button>
          </div>
        </header>
        {(error || message || confirm || groupName?.id) && <div className="space-y-2 px-5 pt-4">
          {groupName?.id && <form onSubmit={e => { e.preventDefault(); const current = groupName; void act({ action: "save_group", id: current.id, name: current.name }, "Ambiente renomeado.").then(result => { if (result) setGroupName(null); }); }} className="flex flex-wrap items-center gap-2">
            <input autoFocus aria-label="Novo nome do ambiente" className={`${field} max-w-sm`} maxLength={120} value={groupName.name} onChange={e => setGroupName({ ...groupName, name: e.target.value })} />
            <button className={primary} disabled={busy || !groupName.name.trim()} type="submit">Salvar nome</button><button className={button} type="button" onClick={() => setGroupName(null)}>Cancelar</button></form>}
          {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm">{message}</p>}
          {confirm && <div role="alertdialog" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
            <span>Excluir {confirm.kind === "group" ? "o ambiente" : "a fila"} “{confirm.name}”? Os leads e o histórico ficam preservados.{confirm.kind === "group" ? " Todas as filas dele serão encerradas." : ""}</span>
            <span className="flex gap-2"><button className={button} onClick={() => setConfirm(null)}>Cancelar</button>
              <button className={`${button} !border-red-500/40 text-red-500`} disabled={busy} onClick={() => { const current = confirm; void act(current.kind === "group" ? { action: "delete_group", id: current.id } : { action: "delete", id: current.id }, "Excluído.").then(result => { if (result) { setConfirm(null); if (current.kind === "group") setOpenGroup(null); } }); }}>Excluir</button></span>
          </div>}
        </div>}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {draft ? <QueueEditor data={data} draft={draft} setDraft={setDraft} busy={busy} profile={profile} formLabel={formLabel}
            onCancel={() => setDraft(null)}
            onSave={() => void act({ action: "save_queue", ...draft }, "Fila salva. Vale para os próximos leads.").then(result => { if (result) setDraft(null); })} />
          : !queuesOf(group.id).length ? <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--glass-border)] p-12 text-center">
              <div className="mb-4 rounded-2xl bg-[var(--hover)] p-4"><Layers size={26} /></div>
              <h3 className="font-medium">Este ambiente ainda não tem filas</h3>
              <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">Uma fila junta os formulários que vão ser distribuídos e os corretores que vão receber os leads.</p>
              <button className={`${primary} mt-5`} onClick={() => setDraft({ group_id: group.id, name: "", enabled: true, forms: [], participants: [] })}><Plus size={16} />Criar fila</button>
            </div>
          : <div className="space-y-4">{queuesOf(group.id).map(q => {
            const links = linksOf(q.id);
            const pending = pendingOf(q.id);
            const distributed = data.history.filter(h => h.roulette_id === q.id && h.status === "distributed").length;
            const next = q.participants.length ? q.cursor_position % q.participants.length : -1;
            return <article key={q.id} className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border)] px-5 py-3">
                <div className="flex min-w-0 items-center gap-3"><Switch checked={q.enabled} disabled={busy} label={`${q.enabled ? "Pausar" : "Ativar"} fila ${q.name}`} onChange={() => void act({ action: "toggle", id: q.id, enabled: !q.enabled }, !q.enabled ? "Fila ativada." : "Fila pausada. Novos leads ficam pendentes.")} />
                  <div className="min-w-0"><h4 className="truncate font-semibold">{q.name}</h4><p className={`text-xs ${q.enabled ? "text-emerald-400" : "text-[var(--muted-foreground)]"}`}>{q.enabled ? "Distribuindo" : "Pausada"} · {distributed} distribuído{distributed === 1 ? "" : "s"} recentemente{pending ? ` · ${pending} pendente${pending > 1 ? "s" : ""}` : ""}</p></div></div>
                <div className="flex flex-wrap items-center gap-1">
                  <button className={button} disabled={busy} onClick={() => setDraft({ id: q.id, group_id: group.id, name: q.name, enabled: q.enabled, forms: links.map(l => ({ source_kind: l.source_kind, form_id: l.form_id, page_id: l.page_id })), participants: q.participants })}><Pencil size={13} />Editar</button>
                  {pending > 0 && <button className={button} disabled={busy || !q.enabled} onClick={() => void act({ action: "retry", id: q.id }, result => `${String(result.distributed ?? 0)} lead(s) distribuído(s).`)}><RotateCw size={13} />Reprocessar ({pending})</button>}
                  <button aria-label={`Excluir fila ${q.name}`} className="rounded-xl p-2 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500" disabled={busy} onClick={() => setConfirm({ kind: "queue", id: q.id, name: q.name })}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="grid items-center gap-4 p-5 lg:grid-cols-[1fr_auto_1.3fr]">
                <div><p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Formulários · {links.length}</p>
                  {links.length ? <ul className="flex flex-wrap gap-2">{links.map(l => <li key={formKey(l)} className="flex max-w-full items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--background)] px-2.5 py-1.5 text-xs"><SourceBadge kind={l.source_kind} /><span className="truncate">{formLabel(l)}</span></li>)}</ul>
                    : <p className="text-xs text-amber-400">Nenhum formulário. Adicione em Editar.</p>}</div>
                <div className="hidden flex-col items-center gap-1 text-[var(--muted-foreground)] lg:flex"><span className={`grid h-12 w-12 place-items-center rounded-full border border-[var(--glass-border)] ${q.enabled ? "text-[var(--primary)]" : ""}`}><Shuffle size={20} className={q.enabled ? "animate-[spin_6s_linear_infinite]" : ""} /></span><ArrowRight size={14} /></div>
                <div><p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Ordem dos corretores · {q.participants.length}</p>
                  <ol className="flex flex-wrap gap-2">{q.participants.map((p, i) => { const info = stageInfo(p.stage_id); const isNext = i === next; return <li key={p.profile_id} className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 ${isNext ? "border-[var(--primary)] bg-[var(--hover)]" : "border-[var(--glass-border)] bg-[var(--background)]"}`}>
                    <span className="text-[10px] tabular-nums text-[var(--muted-foreground)]">{i + 1}</span><Avatar profile={profile(p.profile_id)} size={30} ring={isNext} />
                    <span className="min-w-0"><span className="block truncate text-xs font-medium">{profile(p.profile_id)?.full_name ?? "Usuário removido"}</span><span className="block truncate text-[10px] text-[var(--muted-foreground)]">{info.pipeline?.name ?? "Pipeline indisponível"} → {info.stage?.name ?? "—"}</span></span>
                    {isNext && <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[9px] font-semibold text-[var(--primary-foreground)]">Próximo</span>}
                  </li>; })}</ol></div>
              </div>
            </article>; })}
            <RecentHistory data={data} queueIds={queuesOf(group.id).map(q => q.id)} profile={profile} />
          </div>}
        </div>
      </div>
    </div>}
  </section>;
}

function RecentHistory({ data, queueIds, profile }: { data: Data; queueIds: string[]; profile: (id: string | null | undefined) => Profile | null }) {
  const rows = data.history.filter(h => queueIds.includes(h.roulette_id)).slice(0, 12);
  if (!rows.length) return null;
  return <section className="rounded-2xl border border-[var(--glass-border)] p-5"><h4 className="mb-3 text-sm font-semibold">Últimas distribuições</h4>
    <ul className="divide-y divide-[var(--glass-border)]">{rows.map(h => <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
      <span className="flex min-w-0 items-center gap-2"><Avatar profile={profile(h.assigned_to)} size={24} /><span className="truncate">{h.assigned_to ? profile(h.assigned_to)?.full_name : "Aguardando corretor"}</span><span className="truncate text-[var(--muted-foreground)]">· {data.queues.find(q => q.id === h.roulette_id)?.name}</span></span>
      <span className="flex shrink-0 items-center gap-2"><span className={h.status === "pending" ? "text-amber-400" : "text-emerald-400"}>{h.status === "pending" ? "Pendente" : "Distribuído"}</span><span className="text-[var(--muted-foreground)]">{new Date(h.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></span>
    </li>)}</ul></section>;
}

function QueueEditor({ data, draft, setDraft, busy, profile, formLabel, onSave, onCancel }: {
  data: Data; draft: QueueDraft; setDraft: (draft: QueueDraft) => void; busy: boolean;
  profile: (id: string | null | undefined) => Profile | null; formLabel: (link: FormRef) => string;
  onSave: () => void; onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const pages = data.metaPages ?? [];
  const agents = data.profiles.filter(p => p.is_active && p.auth_user_id);
  const [source, setSource] = useState<"meta" | "genesy">(pages.length || !data.forms.length ? "meta" : "genesy");
  const [pageId, setPageId] = useState(() => draft.forms.find(f => f.source_kind === "meta")?.page_id ?? (pages.find(p => p.is_active) ?? pages[0])?.meta_page_id ?? "");
  const [pageForms, setPageForms] = useState<Record<string, MetaPageForms>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const usedBy = useMemo(() => new Map(data.links.filter(l => l.roulette_id !== draft.id).map(l => [formKey(l), data.queues.find(q => q.id === l.roulette_id)?.name ?? "outra fila"])), [data, draft.id]);
  const loadPage = useCallback(async (id: string, force = false) => {
    if (!id || (requested.current.has(id) && !force)) return;
    requested.current.add(id);
    setPageForms(prev => ({ ...prev, [id]: { loading: true, forms: prev[id]?.forms ?? [] } }));
    try {
      const res = await fetch("/api/crm/roletas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "meta_forms", page_id: id }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Não foi possível carregar os formulários desta página.");
      const forms = (json.forms ?? []) as MetaPageForms["forms"];
      setPageForms(prev => ({ ...prev, [id]: { loading: false, pageActive: json.page_active, forms } }));
      setNames(prev => ({ ...prev, ...Object.fromEntries(forms.map(f => [`meta:${id}:${f.id}`, f.name])) }));
    } catch (error) {
      setPageForms(prev => ({ ...prev, [id]: { loading: false, error: error instanceof Error ? error.message : "Erro ao carregar.", forms: [] } }));
    }
  }, []);
  useEffect(() => { if (source === "meta" && pageId) void loadPage(pageId); }, [source, pageId, loadPage]);
  const label = (f: FormRef) => names[formKey(f)] ?? formLabel(f);
  const pageName = (id: string) => pages.find(p => p.meta_page_id === id)?.page_name ?? "Página";
  const current = pageForms[pageId];
  const term = search.toLocaleLowerCase();
  const metaList: (FormRef & { status: string })[] = (current?.forms ?? [])
    .map(f => ({ source_kind: "meta" as const, form_id: f.id, page_id: pageId, status: f.status }))
    .sort((a, b) => Number(a.status !== "ACTIVE") - Number(b.status !== "ACTIVE"));
  const genesyList: (FormRef & { status: string })[] = data.forms.map(f => ({ source_kind: "genesy" as const, form_id: f.id, page_id: "", status: "ACTIVE" }));
  const visibleForms = (source === "meta" ? metaList : genesyList).filter(f => label(f).toLocaleLowerCase().includes(term));
  const selectedKeys = new Set(draft.forms.map(formKey));
  const toggleForm = (f: FormRef) => setDraft({ ...draft, forms: selectedKeys.has(formKey(f)) ? draft.forms.filter(x => formKey(x) !== formKey(f)) : [...draft.forms, { source_kind: f.source_kind, form_id: f.form_id, page_id: f.page_id }] });
  // Etapa sugerida: primeira etapa da pipeline do próprio corretor (ou da primeira pipeline ativa).
  const defaultStage = (p: Profile) => {
    const own = data.pipelines.find(pl => pl.is_active && (pl.default_assignee_id === p.id || pl.id === p.crm_pipeline_id)) ?? data.pipelines.find(pl => pl.is_active);
    return own?.crm_stages.filter(s => s.is_active).sort((a, b) => a.order_index - b.order_index)[0]?.id ?? "";
  };
  const toggleAgent = (p: Profile) => setDraft({ ...draft, participants: draft.participants.some(x => x.profile_id === p.id) ? draft.participants.filter(x => x.profile_id !== p.id) : [...draft.participants, { profile_id: p.id, stage_id: defaultStage(p) }] });
  const move = (index: number, delta: number) => { const list = [...draft.participants]; const [item] = list.splice(index, 1); list.splice(index + delta, 0, item); setDraft({ ...draft, participants: list }); };
  const canAccess = (p: Profile | null, stageId: string) => {
    if (!p || p.role === "admin") return true;
    const pipeline = data.pipelines.find(pl => pl.crm_stages.some(s => s.id === stageId));
    return !pipeline || pipeline.default_assignee_id === p.id || pipeline.id === p.crm_pipeline_id;
  };
  const valid = Boolean(draft.name.trim()) && draft.participants.length > 0 && draft.participants.every(p => p.stage_id);

  return <form onSubmit={e => { e.preventDefault(); if (valid) onSave(); }} className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" className={button} onClick={onCancel}><ChevronLeft size={15} />Voltar às filas</button>
      <div className="flex items-center gap-3 text-sm"><span>{draft.enabled ? "Fila ativa" : "Fila pausada"}</span><Switch checked={draft.enabled} label="Ativar fila" onChange={() => setDraft({ ...draft, enabled: !draft.enabled })} /></div>
    </div>
    <label className="block max-w-xl space-y-1 text-sm"><span className="font-medium">Nome da fila</span><input autoFocus className={field} maxLength={120} placeholder="Ex.: Lançamento Centro, equipe A" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-[var(--glass-border)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2"><h4 className="flex items-center gap-2 font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--primary)] text-xs text-[var(--primary-foreground)]">1</span>Formulários da fila</h4><span className="text-xs text-[var(--muted-foreground)]">{draft.forms.length} selecionado{draft.forms.length === 1 ? "" : "s"}</span></div>
        {draft.forms.length > 0 && <div className="mb-4 flex flex-wrap gap-1.5">{draft.forms.map(f => <span key={formKey(f)} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--primary)]/40 bg-[var(--hover)] py-1 pl-2 pr-1 text-xs">
          <SourceBadge kind={f.source_kind} /><span className="truncate">{label(f)}</span>{f.source_kind === "meta" && <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]">· {pageName(f.page_id)}</span>}
          <button type="button" aria-label="Tirar formulário da fila" className="rounded-full p-0.5 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500" onClick={() => toggleForm(f)}><X size={12} /></button></span>)}</div>}
        <div className="mb-3 flex rounded-xl border border-[var(--glass-border)] p-0.5 text-xs">{(["meta", "genesy"] as const).map(s => <button key={s} type="button" onClick={() => { setSource(s); setSearch(""); }} className={`flex-1 rounded-lg px-3 py-1.5 ${source === s ? "bg-[var(--hover)] font-medium" : "text-[var(--muted-foreground)]"}`}>{s === "meta" ? "Facebook / Instagram (Meta)" : "Formulários Genesy"}</button>)}</div>
        {source === "meta" && (pages.length ? <label className="mb-3 block space-y-1 text-xs"><span className="font-medium">Primeiro, escolha a página</span>
          <select aria-label="Página do Facebook" className={field} value={pageId} onChange={e => { setPageId(e.target.value); setSearch(""); }}>
            <option value="" disabled>Escolha a página…</option>
            {pages.map(p => <option key={p.meta_page_id} value={p.meta_page_id}>{p.page_name ?? p.meta_page_id}{p.is_active ? "" : " (captura desligada)"}</option>)}
          </select></label>
          : <p className="rounded-xl border border-dashed border-[var(--glass-border)] p-5 text-center text-xs text-[var(--muted-foreground)]">Nenhuma página do Facebook conectada. Conecte em Marketing → Formulários Meta.</p>)}
        {(source === "genesy" || pageId) && <>
          <div className="relative mb-3"><Search size={14} className="absolute left-3 top-3 text-[var(--muted-foreground)]" /><input aria-label="Buscar formulários" className={`${field} !pl-9`} placeholder={source === "meta" ? `Buscar nos formulários de ${pageName(pageId)}…` : "Buscar formulário…"} value={search} onChange={e => setSearch(e.target.value)} /></div>
          {source === "meta" && current?.pageActive === false && <p className="mb-2 text-[11px] text-amber-400">A captura desta página está desligada. Ative-a em Formulários Meta para os leads chegarem.</p>}
          {source === "meta" && current?.loading ? <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">Buscando os formulários da página no Facebook…</p>
          : source === "meta" && current?.error ? <div className="py-6 text-center text-xs"><p className="text-red-400">{current.error}</p><button type="button" className={`${button} mt-3`} onClick={() => void loadPage(pageId, true)}><RotateCw size={13} />Tentar de novo</button></div>
          : <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">{visibleForms.map(f => { const key = formKey(f); const taken = usedBy.get(key); const on = selectedKeys.has(key); return <li key={key}>
            <button type="button" disabled={Boolean(taken) && !on} onClick={() => toggleForm(f)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-45 ${on ? "border-[var(--primary)] bg-[var(--hover)]" : "border-[var(--glass-border)] hover:bg-[var(--hover)]"}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : "border-[var(--glass-border)]"}`}>{on && <Check size={12} />}</span>
              <span className="min-w-0 flex-1 truncate">{label(f)}</span>
              {f.status !== "ACTIVE" && <span className="shrink-0 rounded-full bg-[var(--hover)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">Arquivado</span>}
              {taken && !on && <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]">Na fila “{taken}”</span>}
            </button></li>; })}
            {!visibleForms.length && <li className="py-6 text-center text-xs text-[var(--muted-foreground)]">{search ? "Nenhum formulário com esse nome." : source === "meta" ? "Esta página não tem formulários de cadastro." : "Nenhum formulário Genesy criado ainda."}</li>}</ul>}
        </>}
        {source === "meta" && <p className="mt-3 text-[10px] text-[var(--muted-foreground)]">Ao salvar, a captura dos formulários Meta escolhidos é ligada automaticamente.</p>}
      </section>

      <section className="rounded-2xl border border-[var(--glass-border)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2"><h4 className="flex items-center gap-2 font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--primary)] text-xs text-[var(--primary-foreground)]">2</span>Corretores participantes</h4><span className="text-xs text-[var(--muted-foreground)]">{draft.participants.length} na fila</span></div>
        <div className="mb-4 flex flex-wrap gap-2">{agents.map(p => { const on = draft.participants.some(x => x.profile_id === p.id); return <button key={p.id} type="button" onClick={() => toggleAgent(p)}
          className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors ${on ? "border-[var(--primary)] bg-[var(--hover)] font-medium" : "border-[var(--glass-border)] text-[var(--muted-foreground)] hover:text-[var(--text-title)]"}`}>
          <Avatar profile={p} size={24} />{p.full_name}{on && <Check size={12} className="text-[var(--primary)]" />}</button>; })}</div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Ordem da distribuição e etapa de entrada</p>
        {!draft.participants.length ? <p className="rounded-xl border border-dashed border-[var(--glass-border)] p-5 text-center text-xs text-[var(--muted-foreground)]">Toque nos corretores acima para colocá-los na fila.</p>
        : <ol className="space-y-2">{draft.participants.map((item, i) => { const p = profile(item.profile_id); const warn = Boolean(item.stage_id) && !canAccess(p, item.stage_id); return <li key={item.profile_id} className="rounded-xl border border-[var(--glass-border)] bg-[var(--background)] p-2.5">
          <div className="flex items-center gap-2">
            <span className="w-4 text-center text-xs tabular-nums text-[var(--muted-foreground)]">{i + 1}</span><Avatar profile={p} size={30} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p?.full_name ?? "Usuário removido"}</span>
            <button type="button" aria-label="Subir" disabled={i === 0} className="rounded-lg p-1.5 hover:bg-[var(--hover)] disabled:opacity-30" onClick={() => move(i, -1)}><ArrowUp size={13} /></button>
            <button type="button" aria-label="Descer" disabled={i === draft.participants.length - 1} className="rounded-lg p-1.5 hover:bg-[var(--hover)] disabled:opacity-30" onClick={() => move(i, 1)}><ArrowDown size={13} /></button>
            <button type="button" aria-label="Tirar da fila" className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500" onClick={() => setDraft({ ...draft, participants: draft.participants.filter(x => x.profile_id !== item.profile_id) })}><X size={13} /></button>
          </div>
          <select aria-label={`Etapa de entrada de ${p?.full_name ?? "corretor"}`} className={`${field} mt-2 !py-2 text-xs`} value={item.stage_id} onChange={e => setDraft({ ...draft, participants: draft.participants.map(x => x.profile_id === item.profile_id ? { ...x, stage_id: e.target.value } : x) })}>
            <option value="">Escolha onde o lead entra</option>
            {data.pipelines.filter(pl => pl.is_active).map(pl => <optgroup key={pl.id} label={pl.name}>{pl.crm_stages.filter(s => s.is_active).sort((a, b) => a.order_index - b.order_index).map(s => <option key={s.id} value={s.id}>{pl.name} → {s.name}</option>)}</optgroup>)}
          </select>
          {warn && <p className="mt-1 text-[10px] text-amber-400">Este corretor pode não ter acesso a esta pipeline. Prefira a pipeline dele.</p>}
        </li>; })}</ol>}
      </section>
    </div>

    <div className="flex flex-wrap items-center gap-3 border-t border-[var(--glass-border)] pt-4">
      <button className={primary} type="submit" disabled={busy || !valid}>{busy ? "Salvando…" : "Salvar fila"}</button>
      <button className={button} type="button" onClick={onCancel}>Cancelar</button>
      <p className="text-xs text-[var(--muted-foreground)]">Mudar os corretores reinicia a sequência. Leads já distribuídos continuam com quem recebeu.</p>
    </div>
  </form>;
}
