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

  if (loading) return <main className="grid min-h-dvh place-items-center bg-[#050607] text-white"><Loader2 className="animate-spin text-[#aeb7bd]" /></main>;
  if (error && !collection) return <BrandShell><div className="text-center"><BrandMark /><Building2 className="mx-auto mb-4 mt-8 text-[#707b82]" /><h1 className="text-xl font-semibold">Coleta indisponível</h1><p className="mt-2 text-sm text-[#8d969c]">{error}</p></div></BrandShell>;
  if (!collection) return null;
  if (done) return <BrandShell><div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.045] p-8 text-center shadow-2xl backdrop-blur-xl"><BrandMark /><div className="mx-auto mt-8 grid h-14 w-14 place-items-center rounded-full border border-emerald-300/25 bg-emerald-400/10 text-emerald-300"><Check /></div><h1 className="mt-5 text-2xl font-semibold">Feedback enviado</h1><p className="mt-2 text-sm leading-6 text-[#8d969c]">Obrigado, {brokerName}. Suas respostas já fazem parte da Análise Comercial.</p></div></BrandShell>;

  if (!identified) return <BrandShell><div className="w-full max-w-md"><div className="mb-7 text-center"><BrandMark /><p className="mt-5 text-[10px] font-semibold uppercase tracking-[.24em] text-[#9fa9af]">Análise Comercial</p><h1 className="mt-3 text-2xl font-semibold">Antes de começar, quem é você?</h1><p className="mt-2 text-sm text-[#8d969c]">Selecione seu nome para vincular corretamente as respostas.</p></div><section className="rounded-3xl border border-white/10 bg-white/[.045] p-6 shadow-[0_28px_90px_rgba(0,0,0,.48)] backdrop-blur-xl"><label><span className="mb-2 block text-xs font-medium text-[#c3c9cd]">Corretor</span><select value={brokerId} onChange={(event) => setBrokerId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#101214] px-3 py-3 text-sm outline-none transition focus:border-[#9ca7ad]"><option value="">Selecione seu nome</option>{brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.name}</option>)}</select></label><button disabled={!brokerId} onClick={() => setIdentified(true)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7b868d] to-[#b0b8c0] px-5 py-3 text-sm font-semibold text-[#08090a] shadow-[0_12px_30px_rgba(160,170,176,.14)] disabled:opacity-40">Continuar <ArrowRight size={16} /></button></section></div></BrandShell>;

  return <main className="min-h-dvh bg-[#050607] bg-[radial-gradient(circle_at_12%_5%,rgba(176,184,192,.10),transparent_32%),radial-gradient(circle_at_90%_90%,rgba(96,106,112,.08),transparent_30%)] px-4 py-8 text-white sm:py-12">
    <div className="mx-auto max-w-2xl">
      <header className="mb-7"><BrandMark align="left" /><div className="mt-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-[#9fa9af]"><span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5"><Building2 size={14} /></span>Análise Comercial</div><h1 className="mt-4 text-2xl font-semibold sm:text-3xl">{collection.name}</h1><p className="mt-2 text-sm text-[#8d969c]">{collection.clientName} · leva menos de 3 minutos</p></header>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-[#707b82] to-[#c3c9cd] transition-all" style={{ width: `${progress}%` }} /></div>
      <section className="rounded-3xl border border-white/10 bg-white/[.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,.42)] backdrop-blur-xl sm:p-8">
        <div className="mb-7 grid gap-4 sm:grid-cols-2"><div><span className="mb-2 block text-xs font-medium text-[#c3c9cd]">Corretor</span><button onClick={() => setIdentified(false)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm">{brokerName}<span className="float-right text-[10px] text-[#aeb7bd]">Trocar</span></button></div><div><span className="mb-2 block text-xs font-medium text-[#c3c9cd]">Empreendimento</span><div className="rounded-xl border border-white/15 bg-white/[.07] px-3 py-3 text-sm font-semibold text-[#e0e3e5]">{development?.name}</div></div></div>
        <div className="space-y-6">{collection.questions.map((question) => <Question key={question.id} question={question} value={answers[question.id]} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />)}</div>
        {error && <p className="mt-5 text-sm text-rose-300">{error}</p>}
        <div className="mt-8 flex items-center justify-between gap-3"><button type="button" disabled={developmentIndex === 0 || saving} onClick={() => { setDevelopmentIndex((value) => value - 1); setAnswers({}); }} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8d969c] disabled:invisible"><ArrowLeft size={16} /> Voltar</button><button type="button" disabled={!brokerId || !valid || saving} onClick={() => void submit()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#7b868d] to-[#b0b8c0] px-5 py-3 text-sm font-semibold text-[#08090a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 size={16} className="animate-spin" /> : developmentIndex + 1 === collection.developments.length ? <Check size={16} /> : <ArrowRight size={16} />}{developmentIndex + 1 === collection.developments.length ? "Enviar respostas" : "Salvar e continuar"}</button></div>
      </section>
    </div>
  </main>;
}

function Question({ question, value, onChange }: { question: FormStep; value: unknown; onChange: (value: unknown) => void }) {
  const ratingValues = question.maxRating === 10
    ? Array.from({ length: 11 }, (_, index) => index)
    : Array.from({ length: question.maxRating ?? 5 }, (_, index) => index + 1);
  return <label className="block"><span className="mb-2 block text-sm font-medium text-[#eef0f1]">{question.title}{question.required && <span className="ml-1 text-[#aeb7bd]">*</span>}</span>{question.description && <span className="mb-2 block text-xs text-[#8d969c]">{question.description}</span>}
    {question.type === "rating" ? <div className="flex flex-wrap gap-2">{ratingValues.map((rating) => <button key={rating} type="button" onClick={() => onChange(rating)} className={`grid h-10 w-10 place-items-center rounded-xl border text-sm transition ${value === rating ? "border-[#aeb7bd] bg-white/15 text-white" : "border-white/10 bg-white/5 text-[#929ba0] hover:border-white/25"}`}>{rating === (question.maxRating ?? 5) ? <Star size={14} fill="currentColor" /> : rating}</button>)}</div>
      : question.type === "single_choice" || question.type === "multiple_choice" ? <div className="grid gap-2 sm:grid-cols-2">{question.choices?.map((choice) => { const selected = question.type === "multiple_choice" ? Array.isArray(value) && value.includes(choice.value) : value === choice.value; return <button key={choice.id} type="button" onClick={() => question.type === "multiple_choice" ? onChange(selected ? (value as string[]).filter((item) => item !== choice.value) : [...(Array.isArray(value) ? value : []), choice.value]) : onChange(choice.value)} className={`rounded-xl border px-3 py-3 text-left text-sm transition ${selected ? "border-[#aeb7bd] bg-white/15 text-white" : "border-white/10 bg-white/[.03] text-[#c3c9cd] hover:border-white/25"}`}>{choice.label}</button>; })}</div>
      : question.type === "number" ? <input type="number" min={0} value={String(value ?? "")} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-[#101214] px-3 py-3 text-sm outline-none focus:border-[#9ca7ad]" />
      : <textarea rows={3} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={question.placeholder} className="w-full resize-y rounded-xl border border-white/10 bg-[#101214] px-3 py-3 text-sm outline-none placeholder:text-[#596168] focus:border-[#9ca7ad]" />}
  </label>;
}

function BrandShell({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-dvh place-items-center bg-[#050607] bg-[radial-gradient(circle_at_18%_8%,rgba(176,184,192,.11),transparent_34%),radial-gradient(circle_at_86%_92%,rgba(88,98,104,.09),transparent_32%)] p-6 text-white">{children}</main>;
}

function BrandMark({ align = "center" }: { align?: "center" | "left" }) {
  return <img src="/genesy-logoname.svg" alt="Genesy" className={`h-auto w-40 ${align === "center" ? "mx-auto" : ""}`} />;
}
