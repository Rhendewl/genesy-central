"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Send, TrendingUp } from "lucide-react";
import type { MarketingVgvCustomField } from "@/types/marketing";

type PublicForm = { name: string; client_name: string; custom_fields: MarketingVgvCustomField[] };

export default function PublicVgvSalePage({ params }: { params: { slug: string } }) {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({ sale_date: new Date().toISOString().slice(0, 10) });

  useEffect(() => { void fetch(`/api/public/vgv/${params.slug}`).then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error); setForm(json.form); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Formulário indisponível")); }, [params.slug]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const custom_answers = Object.fromEntries((form?.custom_fields ?? []).map((field) => [field.id, values[field.id] ?? ""]));
      const response = await fetch(`/api/public/vgv/${params.slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, sale_value: Number(values.sale_value), custom_answers }) });
      const json = await response.json(); if (!response.ok) throw new Error(json.error); setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar"); }
    finally { setSaving(false); }
  }

  if (sent) return <main className="grid min-h-dvh place-items-center bg-[#07111d] p-5 text-white"><section className="w-full max-w-md rounded-3xl border border-emerald-400/20 bg-white/[.06] p-8 text-center shadow-2xl"><CheckCircle2 className="mx-auto text-emerald-400" size={48} /><h1 className="mt-5 text-2xl font-semibold">Venda registrada</h1><p className="mt-2 text-sm text-white/60">As informações foram enviadas com sucesso.</p><button onClick={() => { setSent(false); setValues({ sale_date: new Date().toISOString().slice(0, 10) }); }} className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#07111d]">Registrar outra venda</button></section></main>;
  if (!form && !error) return <main className="grid min-h-dvh place-items-center bg-[#07111d] text-white"><Loader2 className="animate-spin" /></main>;
  if (!form) return <main className="grid min-h-dvh place-items-center bg-[#07111d] p-5 text-white"><p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-5 text-sm">{error}</p></main>;

  const field = (id: string, label: string, type = "text", placeholder = "") => <label className="block"><span className="mb-2 block text-xs font-medium text-white/75">{label}</span><input required id={id} type={type} inputMode={type === "number" ? "decimal" : undefined} value={values[id] ?? ""} placeholder={placeholder} onChange={(event) => setValues((current) => ({ ...current, [id]: event.target.value }))} className="h-12 w-full rounded-xl border border-white/10 bg-white/[.07] px-4 text-base text-white outline-none placeholder:text-white/25 focus:border-sky-400" /></label>;
  return <main className="min-h-dvh bg-[#07111d] px-4 py-8 text-white sm:py-12"><form onSubmit={submit} className="mx-auto w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-white/[.055] shadow-2xl"><header className="border-b border-white/10 bg-gradient-to-br from-sky-500/15 to-cyan-400/[.04] p-6 sm:p-8"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-400/15 text-sky-300"><TrendingUp /></span><h1 className="mt-5 text-2xl font-semibold">{form.name}</h1><p className="mt-2 text-sm leading-6 text-white/55">Informe os dados principais da venda. Os campos marcados são obrigatórios.</p></header><div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">{field("broker_name", "Nome do corretor", "text", "Quem realizou a venda?")}{field("sale_date", "Data da venda", "date")}{field("sale_value", "Valor geral da venda", "number", "Ex.: 450000")}{field("buyer_name", "Nome do lead comprador", "text", "Nome do comprador")}{field("campaign_name", "Nome da campanha", "text", "Campanha que gerou o lead")}{field("development_name", "Empreendimento", "text", "Empreendimento vendido")}{form.custom_fields.map((item) => <label key={item.id} className="block sm:col-span-2"><span className="mb-2 block text-xs font-medium text-white/75">{item.label}{item.required ? " *" : ""}</span><input required={item.required} type={item.type === "number" ? "number" : "text"} inputMode={item.type === "number" ? "decimal" : undefined} value={values[item.id] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [item.id]: event.target.value }))} className="h-12 w-full rounded-xl border border-white/10 bg-white/[.07] px-4 text-base text-white outline-none focus:border-sky-400" /></label>)}<input tabIndex={-1} autoComplete="off" value={values.website ?? ""} onChange={(event) => setValues((current) => ({ ...current, website: event.target.value }))} className="absolute -left-[9999px]" aria-hidden="true" />{error && <p className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300 sm:col-span-2">{error}</p>}<button disabled={saving} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{saving ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}{saving ? "Enviando…" : "Registrar venda"}</button></div></form></main>;
}
