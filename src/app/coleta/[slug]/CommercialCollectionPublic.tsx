"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, Loader2, Star } from "lucide-react";
import type { FormStep } from "@/types";

type PublicCollection = { id: string; name: string; clientName?: string; developments: Array<{ name: string }>; questions: FormStep[] };
type Broker = { id: string; name: string };

export function CommercialCollectionPublic({ slug }: { slug: string }) {
  const [collection, setCollection] = useState<PublicCollection | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [brokerId, setBrokerId] = useState("");
  const [identified, setIdentified] = useState(false);
  const [developmentIndex, setDevelopmentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/commercial-collections/${slug}`).then(async (response) => {
      const json = await response.json(); if (!response.ok) throw new Error(json.error);
      setCollection(json.collection); setBrokers(json.brokers);
      const remembered = localStorage.getItem(`genesy-commercial-broker:${json.collection.clientName ?? json.collection.id}`);
      if (remembered && json.brokers.some((broker: Broker) => broker.id === remembered)) setBrokerId(remembered);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível abrir a coleta")).finally(() => setLoading(false));
  }, [slug]);

  const development = collection?.developments[developmentIndex];
  const brokerName = brokers.find((broker) => broker.id === brokerId)?.name;
  const progress = collection ? Math.round(((developmentIndex + 1) / collection.developments.length) * 100) : 0;
  const valid = useMemo(() => collection?.questions.every((question) => {
    const answer = answers[question.id];
    return !question.required || (answer !== undefined && answer !== "" && (!Array.isArray(answer) || answer.length > 0));
  }), [answers, collection]);

  async function submit() {
    if (!collection || !development || !brokerId || !valid) return;
    setSaving(true); setError("");
    let respondentKey = localStorage.getItem("genesy-commercial-respondent-key");
    if (!respondentKey) { respondentKey = crypto.randomUUID(); localStorage.setItem("genesy-commercial-respondent-key", respondentKey); }
    const response = await fetch(`/api/commercial-collections/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ broker_id: brokerId, development_name: development.name, answers, respondent_key: respondentKey }) });
    const json = await response.json(); setSaving(false);
    if (!response.ok) { setError(json.error ?? "Não foi possível salvar"); return; }
    localStorage.setItem(`genesy-commercial-broker:${collection.clientName ?? collection.id}`, brokerId);
    if (developmentIndex + 1 >= collection.developments.length) setDone(true);
    else { setDevelopmentIndex((value) => value + 1); setAnswers({}); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  if (loading) return <main className="grid min-h-dvh place-items-center bg-[#071017] text-white"><Loader2 className="animate-spin text-sky-400" /></main>;
  if (error && !collection) return <main className="grid min-h-dvh place-items-center bg-[#071017] p-6 text-center text-white"><div><Building2 className="mx-auto mb-4 text-slate-500" /><h1 className="text-xl font-semibold">Coleta indisponível</h1><p className="mt-2 text-sm text-slate-400">{error}</p></div></main>;
  if (!collection) return null;
  if (done) return <main className="grid min-h-dvh place-items-center bg-[#071017] p-6 text-white"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.055] p-8 text-center shadow-2xl backdrop-blur-xl"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check /></div><h1 className="mt-5 text-2xl font-semibold">Feedback enviado</h1><p className="mt-2 text-sm leading-6 text-slate-400">Obrigado, {brokerName}. Suas respostas já fazem parte da Análise Comercial.</p></div></main>;

  if (!identified) return <main className="grid min-h-dvh place-items-center bg-[#071017] px-4 py-10 text-white"><div className="w-full max-w-md"><div className="mb-6 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-sky-400/10 text-sky-400"><Building2 size={20} /></div><p className="mt-4 text-xs font-semibold uppercase tracking-[.18em] text-sky-400">Genesy · Análise Comercial</p><h1 className="mt-2 text-2xl font-semibold">Antes de começar, quem é você?</h1><p className="mt-2 text-sm text-slate-400">Selecione seu nome para vincular corretamente as respostas.</p></div><section className="rounded-3xl border border-white/10 bg-white/[.055] p-6 shadow-2xl backdrop-blur-xl"><label><span className="mb-2 block text-xs font-medium text-slate-300">Corretor</span><select value={brokerId} onChange={(event) => setBrokerId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0d1821] px-3 py-3 text-sm outline-none focus:border-sky-500"><option value="">Selecione seu nome</option>{brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.name}</option>)}</select></label><button disabled={!brokerId} onClick={() => setIdentified(true)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold disabled:opacity-40">Continuar <ArrowRight size={16} /></button></section></div></main>;

  return <main className="min-h-dvh bg-[#071017] px-4 py-8 text-white sm:py-12">
    <div className="mx-auto max-w-2xl">
      <header className="mb-7"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-sky-400"><span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-400/10"><Building2 size={14} /></span>Genesy · Análise Comercial</div><h1 className="mt-4 text-2xl font-semibold sm:text-3xl">{collection.name}</h1><p className="mt-2 text-sm text-slate-400">{collection.clientName} · leva menos de 3 minutos</p></header>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-all" style={{ width: `${progress}%` }} /></div>
      <section className="rounded-3xl border border-white/10 bg-white/[.055] p-5 shadow-[0_24px_80px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-8">
        <div className="mb-7 grid gap-4 sm:grid-cols-2"><div><span className="mb-2 block text-xs font-medium text-slate-300">Corretor</span><button onClick={() => setIdentified(false)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm">{brokerName}<span className="float-right text-[10px] text-sky-400">Trocar</span></button></div><div><span className="mb-2 block text-xs font-medium text-slate-300">Empreendimento</span><div className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-3 text-sm font-semibold text-sky-200">{development?.name}</div></div></div>
        <div className="space-y-6">{collection.questions.map((question) => <Question key={question.id} question={question} value={answers[question.id]} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />)}</div>
        {error && <p className="mt-5 text-sm text-rose-300">{error}</p>}
        <div className="mt-8 flex items-center justify-between gap-3"><button type="button" disabled={developmentIndex === 0 || saving} onClick={() => { setDevelopmentIndex((value) => value - 1); setAnswers({}); }} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 disabled:invisible"><ArrowLeft size={16} /> Voltar</button><button type="button" disabled={!brokerId || !valid || saving} onClick={() => void submit()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 size={16} className="animate-spin" /> : developmentIndex + 1 === collection.developments.length ? <Check size={16} /> : <ArrowRight size={16} />}{developmentIndex + 1 === collection.developments.length ? "Enviar respostas" : "Salvar e continuar"}</button></div>
      </section>
    </div>
  </main>;
}

function Question({ question, value, onChange }: { question: FormStep; value: unknown; onChange: (value: unknown) => void }) {
  const ratingValues = question.maxRating === 10
    ? Array.from({ length: 11 }, (_, index) => index)
    : Array.from({ length: question.maxRating ?? 5 }, (_, index) => index + 1);
  return <label className="block"><span className="mb-2 block text-sm font-medium text-slate-100">{question.title}{question.required && <span className="ml-1 text-sky-400">*</span>}</span>{question.description && <span className="mb-2 block text-xs text-slate-400">{question.description}</span>}
    {question.type === "rating" ? <div className="flex flex-wrap gap-2">{ratingValues.map((rating) => <button key={rating} type="button" onClick={() => onChange(rating)} className={`grid h-10 w-10 place-items-center rounded-xl border text-sm transition ${value === rating ? "border-sky-400 bg-sky-400/20 text-sky-200" : "border-white/10 bg-white/5 text-slate-400 hover:border-white/25"}`}>{rating === (question.maxRating ?? 5) ? <Star size={14} fill="currentColor" /> : rating}</button>)}</div>
      : question.type === "single_choice" || question.type === "multiple_choice" ? <div className="grid gap-2 sm:grid-cols-2">{question.choices?.map((choice) => { const selected = question.type === "multiple_choice" ? Array.isArray(value) && value.includes(choice.value) : value === choice.value; return <button key={choice.id} type="button" onClick={() => question.type === "multiple_choice" ? onChange(selected ? (value as string[]).filter((item) => item !== choice.value) : [...(Array.isArray(value) ? value : []), choice.value]) : onChange(choice.value)} className={`rounded-xl border px-3 py-3 text-left text-sm transition ${selected ? "border-sky-400 bg-sky-400/15 text-sky-100" : "border-white/10 bg-white/[.03] text-slate-300 hover:border-white/25"}`}>{choice.label}</button>; })}</div>
      : question.type === "number" ? <input type="number" min={0} value={String(value ?? "")} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-[#0d1821] px-3 py-3 text-sm outline-none focus:border-sky-500" />
      : <textarea rows={3} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={question.placeholder} className="w-full resize-y rounded-xl border border-white/10 bg-[#0d1821] px-3 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-sky-500" />}
  </label>;
}
