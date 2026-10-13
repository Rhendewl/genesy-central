"use client";
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Toaster } from 'sonner';
import { Button } from '@/components/ui/button';
const Calculator = dynamic(() => import('@/components/calculadora/FlowCalculator'), { ssr: false });

export default function PublicCalculator() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<{ title?: string; granted?: boolean; error?: string } | null>(null);
  const [resume, setResume] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch(`/api/public/calculadora/${encodeURIComponent(slug)}`, { cache: 'no-store' }).then(r => r.json()).then(data => { if (active) setState(data); }).catch(() => { if (active) setState({ error: 'Não foi possível abrir a calculadora.' }); });
    return () => { active = false; };
  }, [slug]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/public/calculadora/${encodeURIComponent(slug)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, action: resume ? 'resume' : 'register' }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setState(s => ({ ...s, granted: true }));
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível continuar.'); }
    finally { setBusy(false); }
  }
  if (!state) return <div className="p-12 text-center text-[var(--text-title)]">Carregando calculadora…</div>;
  if (state.error) return <div className="mx-auto max-w-lg p-12 text-center text-[var(--text-title)]">{state.error}</div>;
  if (state.granted) return <><Calculator publicMode /><Toaster position="top-center" /></>;
  return <div className="min-h-dvh bg-[var(--background)] px-4 py-12 text-[var(--text-title)]">
    <div className="lc-card mx-auto max-w-lg p-6 sm:p-8">
      <Image src="/genesy-logo.svg" alt="Genesy" width={137} height={30} className="mb-8 h-6 w-auto" />
      <h1 className="text-2xl font-bold">{state.title}</h1>
      <p className="mb-7 mt-3 text-sm text-[var(--text-subtitle)]">{resume ? 'Informe o contato usado no cadastro para acessar neste dispositivo.' : 'Cadastre-se para simular parcelas, gerar seu PDF e compartilhar seu fluxo de pagamento.'}</p>
      <form onSubmit={submit} className="space-y-4">
        {!resume && <>
          <label className="block text-sm">Nome<input name="name" required maxLength={160} autoComplete="name" className="editor-input mt-2 w-full !h-11" /></label>
          <label className="block text-sm">E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" className="editor-input mt-2 w-full !h-11" /></label>
          <label className="block text-sm">Você é<select name="profile" required defaultValue="" className="editor-input mt-2 w-full !h-11"><option value="" disabled>Selecione seu perfil</option><option value="corretor">Corretor</option><option value="imobiliaria">Imobiliária</option><option value="construtora">Construtora</option></select></label>
          <label className="block text-sm">CRECI <span className="text-[var(--muted-foreground)]">(opcional)</span><input name="creci" maxLength={80} className="editor-input mt-2 w-full !h-11" /></label>
        </>}
        <label className="block text-sm">Contato com DDD<input name="phone" type="tel" autoComplete="tel" required maxLength={24} placeholder="(85) 99999-9999" className="editor-input mt-2 w-full !h-11" /></label>
        <div aria-hidden="true" className="hidden"><input name="website" tabIndex={-1} autoComplete="off" /></div>
        {!resume && <p className="text-xs leading-relaxed text-[var(--text-subtitle)]">Seus dados serão usados para registrar seu interesse e permitir o contato da equipe responsável por este link. O acesso será lembrado neste navegador.</p>}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <Button type="submit" loading={busy} className="!h-12 w-full">{resume ? 'Acessar calculadora' : 'Cadastrar e acessar calculadora'}</Button>
      </form>
      <button type="button" onClick={() => { setResume(!resume); setError(''); }} className="mt-5 w-full text-sm underline underline-offset-4">{resume ? 'Quero fazer meu cadastro' : 'Já me cadastrei'}</button>
    </div>
  </div>;
}
