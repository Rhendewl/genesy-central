"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
type Capture = { id: string; name: string; email: string; phone: string; profile: string; creci: string | null; created_at: string; lead_id: string | null; share: { id: string; title: string } };
export default function CalculatorLeads() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [shares, setShares] = useState<{ id: string; title: string }[]>([]);
  const [share, setShare] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(0); const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { fetch('/api/calculadora/shares').then(r => r.json()).then(d => setShares(d.shares ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), share, search });
      fetch(`/api/calculadora/captures?${params}`).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); if (active) { setCaptures(data.captures); setCount(data.count ?? 0); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [page, share, search]);
  return <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 pb-28 text-[var(--text-title)]">
    <div><h1 className="text-2xl font-bold">Leads capturados</h1><p className="mt-2 text-sm text-[var(--text-subtitle)]">Cadastros recebidos pela calculadora pública e vinculados ao CRM.</p></div>
    <div className="flex flex-wrap gap-3"><input aria-label="Buscar lead pelo nome" placeholder="Buscar por nome" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="editor-input !h-11 sm:!w-72" /><select aria-label="Filtrar por link" className="editor-input !h-11 sm:!w-72" value={share} onChange={e => { setShare(e.target.value); setPage(0); }}><option value="">Todos os links</option>{shares.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
    {loading ? <p>Carregando…</p> : error ? <p role="alert">{error}</p> : <><p className="text-sm text-[var(--text-subtitle)]">{count} cadastro(s)</p><div className="grid gap-3 sm:grid-cols-2">{captures.map(c => <article key={c.id} className="lc-card space-y-2 p-5"><h2 className="font-semibold">{c.name}</h2><p className="break-all text-sm">{c.email}</p><p className="text-sm">{c.phone}</p><p className="text-xs text-[var(--text-subtitle)]">{({ corretor: 'Corretor', imobiliaria: 'Imobiliária', construtora: 'Construtora' } as Record<string,string>)[c.profile]}{c.creci ? ` · CRECI ${c.creci}` : ''}</p><p className="text-xs text-[var(--text-subtitle)]">{c.share?.title} · {new Date(c.created_at).toLocaleDateString('pt-BR')}</p>{c.lead_id && <Link className="inline-block text-sm underline underline-offset-4" href={`/crm?lead=${c.lead_id}`}>Consultar no CRM</Link>}</article>)}</div>{!captures.length && <p>Nenhum cadastro encontrado.</p>}<div className="flex items-center gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button><span className="text-sm">Página {page + 1}</span><Button variant="outline" disabled={(page + 1) * 50 >= count} onClick={() => setPage(p => p + 1)}>Próxima</Button></div></>}
  </div>;
}
