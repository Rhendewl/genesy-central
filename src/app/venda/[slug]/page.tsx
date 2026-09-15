"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import type { MarketingVgvCustomField } from "@/types/marketing";

type PublicForm = { name: string; client_name: string; custom_fields: MarketingVgvCustomField[] };

export default function PublicVgvSalePage({ params }: { params: { slug: string } }) {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [saleValue, setSaleValue] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({ sale_date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    void fetch(`/api/public/vgv/${params.slug}`).then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setForm(json.form);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Formulário indisponível"));
  }, [params.slug]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const custom_answers = Object.fromEntries((form?.custom_fields ?? []).map((field) => [field.id, values[field.id] ?? ""]));
      const response = await fetch(`/api/public/vgv/${params.slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, sale_value: saleValue, custom_answers }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar"); }
    finally { setSaving(false); }
  }

  if (!form && !error) return <BrandShell><Loader2 className="animate-spin text-[#afb8c0]" /></BrandShell>;
  if (!form) return <BrandShell><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.045] p-7 text-center"><BrandMark /><h1 className="mt-7 text-xl font-semibold">Formulário indisponível</h1><p className="mt-2 text-sm text-[#afb8c0]">{error}</p></section></BrandShell>;
  if (sent) return <BrandShell><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.045] p-8 text-center shadow-2xl backdrop-blur-xl"><BrandMark /><div className="mx-auto mt-8 grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-[#afb8c0] text-black"><Check size={27} /></div><h1 className="mt-5 text-2xl font-semibold">Venda registrada</h1><p className="mt-2 text-sm leading-6 text-[#afb8c0]">As informações já foram vinculadas ao cliente correto.</p><button onClick={() => { setSent(false); setSaleValue(0); setValues({ sale_date: new Date().toISOString().slice(0, 10) }); }} className="mt-6 min-h-12 rounded-xl border border-white/15 bg-[#afb8c0] px-5 py-3 text-sm font-semibold text-black transition hover:bg-white">Registrar outra venda</button></section></BrandShell>;

  const field = (id: string, label: string, type = "text", placeholder = "") => <label className="block"><span className="mb-2 block text-sm font-medium text-[#e4e7e9]">{label}</span><input required id={id} type={type} inputMode={type === "number" ? "decimal" : undefined} value={values[id] ?? ""} placeholder={placeholder} onChange={(event) => setValues((current) => ({ ...current, [id]: event.target.value }))} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#101214] px-4 text-base text-white outline-none transition placeholder:text-[#667178] focus:border-[#afb8c0] focus:shadow-[0_0_28px_rgba(175,184,192,.08)]" /></label>;

  return <BrandShell><form onSubmit={submit} className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white/[.045] shadow-[0_28px_90px_rgba(0,0,0,.48)] backdrop-blur-xl"><header className="border-b border-white/10 p-6 sm:p-8"><BrandMark align="left" /><p className="mt-7 text-[11px] font-semibold uppercase tracking-[.22em] text-[#afb8c0]">Registro comercial</p><h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">{form.name}</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[#afb8c0]">Preencha os dados da venda abaixo. As respostas serão vinculadas automaticamente ao cliente responsável.</p></header><div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">{field("broker_name", "Nome do corretor", "text", "Quem realizou a venda?")}{field("sale_date", "Data da venda", "date")}<label className="block"><span className="mb-2 block text-sm font-medium text-[#e4e7e9]">Valor geral da venda</span><PublicMoneyInput value={saleValue} onChange={setSaleValue} /></label>{field("buyer_name", "Nome do lead comprador", "text", "Nome do comprador")}{field("campaign_name", "O lead veio por qual campanha?", "text", "Informe o nome da campanha")}{field("development_name", "Qual foi o empreendimento comprado?", "text", "Informe o empreendimento")}{form.custom_fields.map((item) => <label key={item.id} className="block sm:col-span-2"><span className="mb-2 block text-sm font-medium text-[#e4e7e9]">{item.label}{item.required ? " *" : ""}</span><input required={item.required} type={item.type === "number" ? "number" : "text"} inputMode={item.type === "number" ? "decimal" : undefined} value={values[item.id] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#101214] px-4 text-base text-white outline-none transition focus:border-[#afb8c0]" /></label>)}<input tabIndex={-1} autoComplete="off" value={values.website ?? ""} onChange={(event) => setValues((current) => ({ ...current, website: event.target.value }))} className="absolute -left-[9999px]" aria-hidden="true" />{error && <p className="rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-200 sm:col-span-2">{error}</p>}<button disabled={saving || saleValue <= 0} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#afb8c0] px-5 py-3 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-50 sm:col-span-2">{saving ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}{saving ? "Enviando…" : "Registrar venda"}</button></div></form></BrandShell>;
}

function BrandShell({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-dvh place-items-center bg-[#050607] bg-[radial-gradient(circle_at_18%_8%,rgba(176,184,192,.11),transparent_34%),radial-gradient(circle_at_86%_92%,rgba(88,98,104,.09),transparent_32%)] p-4 py-8 text-white sm:p-8">{children}</main>;
}

function BrandMark({ align = "center" }: { align?: "center" | "left" }) {
  return <img src="/genesy-logoname.svg" alt="Genesy" className={`h-auto w-28 ${align === "center" ? "mx-auto" : ""}`} />;
}

function PublicMoneyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const display = value > 0 ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }) : "";
  return <input required type="text" inputMode="numeric" value={display} placeholder="R$ 0,00" onChange={(event) => { const digits = event.target.value.replace(/\D/g, ""); onChange(digits ? Number(digits) / 100 : 0); }} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#101214] px-4 text-base text-white outline-none transition placeholder:text-[#667178] focus:border-[#afb8c0] focus:shadow-[0_0_28px_rgba(175,184,192,.08)]" />;
}
