"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { buildPublicUrl } from '@/lib/public-url';

type Share = { id: string; slug: string; title: string; active: boolean; pipeline_id: string; stage_id: string };
type Pipeline = { id: string; name: string; crm_stages: { id: string; name: string; is_active: boolean }[] };
export default function CalculatorSharing() {
  const [shares, setShares] = useState<Share[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [title, setTitle] = useState('Calculadora de fluxo de pagamento');
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const r = await fetch('/api/calculadora/shares'); const data = await r.json(); if (!r.ok) throw new Error(data.error); setShares(data.shares); setPipelines(data.pipelines); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  function url(slug: string) { return ['localhost','127.0.0.1'].includes(window.location.hostname) ? `${window.location.origin}/simular/${slug}` : buildPublicUrl(`/simular/${slug}`); }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try { const r = await fetch('/api/calculadora/shares', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing, title, pipeline_id: pipelineId, stage_id: stageId }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setEditing(null); await load(); toast.success('Link de compartilhamento salvo.'); }
    catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function toggle(share: Share) {
    const r = await fetch('/api/calculadora/shares', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: share.id, active: !share.active }) });
    const data = await r.json(); if (!r.ok) return toast.error(data.error); setShares(rows => rows.map(row => row.id === share.id ? data.share : row));
  }
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 pb-28 text-[var(--text-title)]">
    <div><h1 className="text-2xl font-bold">Compartilhamento da calculadora</h1><p className="mt-2 text-sm text-[var(--text-subtitle)]">Crie links públicos e escolha onde os cadastros entram no seu CRM.</p></div>
    {loading ? <p>Carregando…</p> : error ? <div role="alert" className="lc-card p-6"><p>{error}</p><Button className="mt-4" onClick={load}>Tentar novamente</Button></div> : <>
      <form onSubmit={save} className="lc-card space-y-4 p-5">
        <h2 className="font-semibold">{editing ? 'Editar destino do link' : 'Novo link de captura'}</h2>
        <label className="block text-sm">Nome do link<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className="editor-input mt-2 !h-11" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Pipeline de destino<select required value={pipelineId} onChange={e => { setPipelineId(e.target.value); setStageId(''); }} className="editor-input mt-2 !h-11"><option value="">Selecione</option>{pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="block text-sm">Etapa de entrada<select required value={stageId} onChange={e => setStageId(e.target.value)} className="editor-input mt-2 !h-11"><option value="">Selecione</option>{pipelines.find(p => p.id === pipelineId)?.crm_stages.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        </div>
        <p className="text-xs text-[var(--text-subtitle)]">O visitante informa nome, e-mail, contato e perfil. CRECI é opcional. O link não dá acesso à plataforma interna.</p>
        <Button type="submit" loading={saving}>{editing ? 'Salvar alterações' : 'Criar link de compartilhamento'}</Button>
        {editing && <Button type="button" variant="outline" className="ml-3" onClick={() => setEditing(null)}>Cancelar</Button>}
      </form>
      {shares.map(s => <div key={s.id} className="lc-card space-y-3 p-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{s.title}</h2><span className="text-xs text-[var(--text-subtitle)]">{s.active ? 'Ativo' : 'Pausado'}</span></div><p className="text-sm text-[var(--text-subtitle)]">Destino: {pipelines.find(p => p.id === s.pipeline_id)?.name ?? 'Pipeline indisponível'} · {pipelines.find(p => p.id === s.pipeline_id)?.crm_stages.find(st => st.id === s.stage_id)?.name ?? 'Etapa indisponível'}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url(s.slug)); toast.success('Link copiado.'); } catch { toast.error('Não foi possível copiar o link.'); } }}>Copiar link</Button><a className="lc-btn px-3 py-2 text-sm" href={url(s.slug)} target="_blank" rel="noopener noreferrer">Abrir página pública</a><Button variant="outline" onClick={() => { setEditing(s.id); setTitle(s.title); setPipelineId(s.pipeline_id); setStageId(s.stage_id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</Button><Button variant="outline" onClick={() => toggle(s)}>{s.active ? 'Pausar' : 'Ativar'}</Button></div></div>)}
      {!shares.length && <p className="text-sm text-[var(--text-subtitle)]">Nenhum link criado ainda.</p>}
    </>}
  </div>;
}
