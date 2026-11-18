"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RotateCw, Shuffle, Pencil, Trash2, ArrowRight, Users, Activity, Clock3, Search } from "lucide-react";

type Roulette = { id: string; name: string; source_kind: "genesy" | "meta"; form_id: string; page_id: string; stage_ids: string[]; enabled: boolean; deleted_at?: string | null; cursor_position?: number };
type Draft = Omit<Roulette, "id"> & { id?: string };
type Data = {
  roulettes: Roulette[]; forms: { id: string; name: string }[];
  metaForms: { form_id: string; form_name: string | null; page_id: string; is_active: boolean }[];
  pipelines: { id: string; name: string; is_active: boolean; default_assignee_id: string | null; crm_stages: { id: string; name: string; is_active: boolean; order_index: number }[] }[];
  profiles: { id: string; full_name: string; is_active: boolean; auth_user_id: string | null }[];
  history: { id: string; roulette_id: string; status: string; lead_id: string | null; pipeline_id: string | null; assigned_to: string | null; created_at: string }[];
  pendingCount: number;
};
const emptyDraft = (): Draft => ({ name: "", source_kind: "genesy", form_id: "", page_id: "", stage_ids: [], enabled: true });
const field = "w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] p-3 text-sm text-[var(--text-title)]";
const button = "rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--hover)] disabled:opacity-50";
function RouletteSwitch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}
    className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
    style={{ background: checked ? "var(--primary)" : "var(--border-card-hover)" }}>
    <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }} />
  </button>;
}

export function LeadRoulettes() {
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/crm/roletas", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar as roletas.");
    setData(result);
  }, []);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  async function save(body: Draft | { action: "retry" | "delete" | "toggle"; id: string; enabled?: boolean }) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/crm/roletas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      if ("action" in body) {
        if (body.action === "delete") { setMessage("Roleta excluída. O histórico e os leads foram preservados."); setConfirmDelete(null); if (draft?.id === body.id) setDraft(null); }
        else if (body.action === "toggle") setMessage(body.enabled ? "Roleta ativada." : "Roleta pausada. Novas entradas ficarão pendentes.");
        else setMessage(`${result.distributed} lead(s) distribuído(s). Até 25 entradas por vez.`);
      }
      else { setDraft(null); setMessage("Roleta salva. A configuração vale para as próximas entradas."); }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }
  const ownerName = (id: string | null) => data?.profiles.find(p => p.id === id)?.full_name ?? "Sem proprietário";
  const live = data?.roulettes.filter(r => !r.deleted_at) ?? [];
  const formName = (r: Roulette) => data?.forms.find(f => f.id === r.form_id)?.name || data?.metaForms.find(f => f.form_id === r.form_id && f.page_id === r.page_id)?.form_name || r.form_id;
  const visible = live.filter(r => `${r.name} ${formName(r)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <section className="space-y-5 px-4 pt-6 sm:px-6 text-[var(--text-title)]">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Shuffle size={21} /> Roletas de leads</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Um lead por vez, alternando igualmente entre as pipelines disponíveis de cada formulário.</p></div>
      <button className={`${button} !border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm`} disabled={!data || busy} onClick={() => { setDraft(emptyDraft()); setError(""); setMessage(""); }}><Plus size={16} className="mr-2 inline" />Nova roleta</button>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-500/10 p-3 text-sm">{message}</p>}
    {!data && !error && <p role="status">Carregando roletas…</p>}
    {data && <>
      <div className="grid grid-cols-3 gap-3">{[
        { label: "Roletas ativas", value: live.filter(r => r.enabled).length, icon: Activity },
        { label: "Pipelines na distribuição", value: new Set(live.flatMap(r => r.stage_ids.map(id => data.pipelines.find(p => p.crm_stages.some(s => s.id === id))?.id).filter(Boolean))).size, icon: Users },
        { label: "Entradas pendentes", value: data.pendingCount, icon: Clock3 },
      ].map(item => <div key={item.label} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] p-3 sm:p-5"><item.icon size={16} className="mb-3 text-[var(--muted-foreground)]" /><p className="text-2xl font-semibold tabular-nums">{item.value}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{item.label}</p></div>)}</div>
      <details className="rounded-xl border border-[var(--glass-border)] px-4 py-3 text-sm text-[var(--muted-foreground)]"><summary className="cursor-pointer font-medium text-[var(--text-title)]">Como funciona a distribuição</summary><p className="mt-3 leading-relaxed">Cada novo lead vai para a próxima pipeline disponível e recebe o proprietário dela como responsável. Defina os proprietários em Pipelines → Editar. Na Meta, mantenha a captura do formulário ativa. Ao pausar, as entradas ficam pendentes para reprocessamento.</p></details>
      {draft && <form onSubmit={e => { e.preventDefault(); void save(draft); }} className="space-y-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Configuração da distribuição</p><h3 className="mt-1 text-lg font-semibold">{draft.id ? "Editar roleta" : "Nova roleta"}</h3></div><Shuffle size={22} className="text-[var(--muted-foreground)]" /></div>
        <label className="block space-y-1 text-sm"><span>Nome da roleta</span><input className={field} required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm"><span>Origem</span><select className={field} disabled={!!draft.id} value={draft.source_kind} onChange={e => setDraft({ ...draft, source_kind: e.target.value as Draft["source_kind"], form_id: "", page_id: "" })}><option value="genesy">Formulário Genesy</option><option value="meta">Formulário Meta</option></select></label>
          <label className="block space-y-1 text-sm"><span>Formulário</span><select className={field} required disabled={!!draft.id} value={JSON.stringify([draft.page_id, draft.form_id])} onChange={e => { const [page_id, form_id] = JSON.parse(e.target.value); setDraft({ ...draft, page_id, form_id }); }}>
            <option value={'["",""]'}>Selecione um formulário</option>
            {draft.source_kind === "genesy" ? data.forms.map(f => <option key={f.id} value={JSON.stringify(["", f.id])}>{f.name}</option>) : data.metaForms.map(f => <option key={`${f.page_id}:${f.form_id}`} value={JSON.stringify([f.page_id, f.form_id])}>{f.form_name || f.form_id} · Página {f.page_id}{!f.is_active ? " (captura pausada)" : ""}</option>)}
          </select></label>
        </div>
        {draft.source_kind === "meta" && <p className="text-xs text-[var(--text-muted)]">Para um formulário aparecer aqui, configure sua captura em Formulários Meta.</p>}
        <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Pipelines participantes e etapa de entrada</legend>
          {data.pipelines.map(p => {
            const owner = data.profiles.find(u => u.id === p.default_assignee_id && u.is_active && u.auth_user_id);
            const stages = p.crm_stages.filter(s => s.is_active).sort((a,b) => a.order_index-b.order_index);
            const selected = draft.stage_ids.find(id => p.crm_stages.some(s => s.id === id));
            return <div key={p.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 transition-colors ${selected ? "border-[var(--primary)] bg-[var(--hover)]" : "border-[var(--glass-border)]"}`}>
              <label className="flex min-w-48 flex-1 items-center gap-3 text-sm"><input type="checkbox" checked={!!selected} disabled={(!p.is_active || !owner || !stages.length) && !selected} onChange={e => setDraft({ ...draft, stage_ids: e.target.checked ? [...draft.stage_ids, stages[0].id] : draft.stage_ids.filter(id => id !== selected) })} />
                <span>{p.name}{!p.is_active ? " (inativa)" : ""}<small className="block text-[var(--text-muted)]">{owner ? owner.full_name : "Defina um proprietário ativo"}</small></span></label>
              {selected && <select aria-label={`Etapa de entrada em ${p.name}`} className={`${field} sm:!w-64`} value={selected} onChange={e => setDraft({ ...draft, stage_ids: draft.stage_ids.map(id => id === selected ? e.target.value : id) })}>{!stages.some(s => s.id === selected) && <option value={selected}>Etapa indisponível — escolha outra</option>}{stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
            </div>;
          })}
          {draft.stage_ids.filter(id => !data.pipelines.some(p => p.crm_stages.some(s => s.id === id))).map(id => <div key={id} className="text-sm">Destino removido <button type="button" className={button} onClick={() => setDraft({ ...draft, stage_ids: draft.stage_ids.filter(stageId => stageId !== id) })}>Remover da roleta</button></div>)}
        </fieldset>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--hover)] p-4"><div><p className="text-sm font-medium">{draft.enabled ? "Distribuição ativa" : "Distribuição pausada"}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Você também pode alterar pelo card após salvar.</p></div><RouletteSwitch checked={draft.enabled} disabled={busy} label="Ativar roleta" onChange={() => setDraft({ ...draft, enabled: !draft.enabled })} /></div>
        <p className="text-xs text-[var(--text-muted)]">Ao pausar, novas entradas ficam pendentes. Alterar participantes reinicia a sequência; leads já distribuídos permanecem com seus responsáveis.</p>
        <div className="flex gap-2"><button className={button} disabled={busy || !draft.stage_ids.length} type="submit">{busy ? "Salvando…" : "Salvar roleta"}</button><button className={button} disabled={busy} type="button" onClick={() => setDraft(null)}>Cancelar</button></div>
      </form>}
      {live.length > 0 && <div className="relative max-w-sm"><Search size={16} className="absolute left-3 top-3.5 text-[var(--muted-foreground)]" /><input aria-label="Buscar roletas" placeholder="Buscar por roleta ou formulário…" className={`${field} !pl-10`} value={query} onChange={e => setQuery(e.target.value)} /></div>}
      {!visible.length && !draft && <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--glass-border)] p-10 text-center"><div className="mb-4 rounded-2xl bg-[var(--hover)] p-4"><Shuffle size={26} /></div><h3 className="font-medium">{query ? "Nenhuma roleta encontrada" : "Distribua oportunidades entre sua equipe"}</h3><p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">{query ? "Tente outro nome ou formulário." : "Escolha um formulário, selecione as pipelines e deixe a sequência cuidar da distribuição."}</p>{!query && <button className={`${button} mt-5`} onClick={() => setDraft(emptyDraft())}>Criar primeira roleta</button>}</div>}
      <div className="grid gap-4 xl:grid-cols-2">{visible.map(r => {
        const pending = data.history.filter(h => h.roulette_id === r.id && h.status === "pending").length;
        return <article key={r.id} className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] transition-shadow hover:shadow-lg">
        <div className="p-5"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><div className="rounded-xl bg-[var(--hover)] p-2.5"><Shuffle size={19} /></div><div className="min-w-0"><h3 className="truncate font-semibold">{r.name}</h3><span className={`mt-1 inline-flex items-center gap-1.5 text-xs ${r.enabled ? "text-emerald-500" : "text-[var(--muted-foreground)]"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{r.enabled ? "Distribuindo" : "Pausada"}</span></div></div><RouletteSwitch checked={r.enabled} disabled={busy} label={`${r.enabled ? "Pausar" : "Ativar"} roleta ${r.name}`} onChange={() => void save({ action: "toggle", id: r.id, enabled: !r.enabled })} /></div>
        <div className="mt-5 flex items-center gap-2 text-xs"><span className="rounded-md border border-[var(--glass-border)] px-2 py-1 font-medium">{r.source_kind === "meta" ? "Meta Ads" : "Genesy"}</span><span className="truncate text-[var(--muted-foreground)]">{formName(r)}</span></div>
        <div className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]"><span>Sequência de distribuição</span><span className="h-px flex-1 bg-[var(--glass-border)]" /></div>
        <ol className="flex flex-col gap-2">{r.stage_ids.map((id, i) => { const p = data.pipelines.find(p => p.crm_stages.some(s => s.id === id)); const next = i === (r.cursor_position ?? 0); return <li key={id} className="flex items-center gap-3 rounded-xl bg-[var(--hover)] px-3 py-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--glass-border)] text-xs tabular-nums">{i+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p?.name || "Pipeline indisponível"}</p><p className="truncate text-xs text-[var(--muted-foreground)]">{ownerName(p?.default_assignee_id ?? null)} · {p?.crm_stages.find(s => s.id === id)?.name || "Etapa indisponível"}</p></div>{next && <span title="A sequência parte deste destino e pula os indisponíveis" className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">Próxima <ArrowRight size={12} /></span>}</li>; })}</ol>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--glass-border)] px-5 py-3"><button className="mr-auto flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[var(--hover)] disabled:opacity-50" disabled={busy} onClick={() => setDraft({ ...r })}><Pencil size={13} />Editar</button><button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[var(--hover)] disabled:opacity-40" disabled={busy || !r.enabled} onClick={() => void save({ action: "retry", id: r.id })}><RotateCw size={13} />Reprocessar{pending > 0 ? ` (${pending})` : ""}</button><button aria-label={`Excluir roleta ${r.name}`} className="rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50" disabled={busy} onClick={() => setConfirmDelete(r.id)}><Trash2 size={14} /></button></div>
        {confirmDelete === r.id && <div role="alertdialog" aria-label="Excluir roleta" className="space-y-3 border-t border-red-500/20 bg-red-500/5 p-5"><p className="text-sm font-medium">Excluir “{r.name}”?</p><p className="text-xs leading-relaxed text-[var(--muted-foreground)]">A distribuição deste formulário voltará à configuração fixa. Os leads e o histórico serão preservados. Entradas pendentes precisam ser distribuídas antes da exclusão.</p><div className="flex gap-2"><button className={button} disabled={busy} onClick={() => setConfirmDelete(null)}>Cancelar</button><button className={`${button} !border-red-500/30 text-red-500`} disabled={busy} onClick={() => void save({ action: "delete", id: r.id })}>{busy ? "Excluindo…" : "Excluir roleta"}</button></div></div>}
      </article>; })}</div>
      <div className="space-y-3"><h3 className="font-semibold">Histórico de distribuição</h3><p className="text-xs text-[var(--text-muted)]">Últimas 100 entradas · {data.pendingCount} pendente(s) no total</p>
        <div className="overflow-x-auto rounded-xl border border-[var(--glass-border)]"><table className="w-full text-left text-sm"><thead><tr>{["Recebido em", "Roleta", "Pipeline", "Responsável", "Situação"].map(label => <th className="whitespace-nowrap p-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{data.history.map(h => <tr key={h.id} className="border-t border-[var(--glass-border)]"><td className="whitespace-nowrap p-3">{new Date(h.created_at).toLocaleString("pt-BR")}</td><td className="p-3">{data.roulettes.find(r => r.id === h.roulette_id)?.name}</td><td className="p-3">{data.pipelines.find(p => p.id === h.pipeline_id)?.name || "—"}</td><td className="p-3">{h.assigned_to ? ownerName(h.assigned_to) : "—"}</td><td className="p-3">{h.status === "pending" ? "Pendente" : "Distribuído"}</td></tr>)}</tbody></table>{!data.history.length && <p className="p-4 text-sm">Nenhuma entrada recebida ainda.</p>}</div>
      </div>
    </>}
  </section>;
}
