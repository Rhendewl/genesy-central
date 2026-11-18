"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileSignature,
  Plus,
  Copy,
  Loader2,
  CheckCircle2,
  X,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  templateFields,
  renderContract,
  ROLES,
  CLIENT_COMPANY_TYPES,
  type ContractDocument,
  type ContractProfile,
  type ContractTemplate,
  type ContractRole,
} from "@/lib/contracts/model";
import "./contracts.css";
import { signerRoles } from "@/lib/contracts/signature-styles";
import { ContractPaper } from "./ContractPaper";
import { derivedFields, fieldGroup, isMoney, money, numeric, today, qualification, locationDefaults, fieldLabel } from "@/lib/contracts/fields";
import { downloadContract } from "@/lib/contracts/pdf";
const defaults: ContractProfile = { name: "", document: "", address: "" };
const initialClient = {
  company_type: "imobiliaria",
  name: "",
  document: "",
  address: "",
  email: "",
  phone: "",
  contact_name: "",
  monthly_fee: "0",
};
const defaultSigners = () => [
  { name: "", email: "", document: "", role: "contratada" as ContractRole },
  { name: "", email: "", document: "", role: "cliente" as ContractRole },
  { name: "", email: "", document: "", role: "testemunha" as ContractRole },
  { name: "", email: "", document: "", role: "testemunha" as ContractRole },
];
function savedLocation() {
  try { return locationDefaults(JSON.parse(localStorage.getItem("contract-location") || "{}")); }
  catch { return locationDefaults(); }
}
const example =
  "CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nCONTRATADA: {{contratada_nome}}, inscrita sob {{contratada_documento}}, com endereço {{contratada_endereco}}.\n\nCONTRATANTE: {{cliente_nome}}, inscrita sob {{cliente_documento}}, com endereço {{cliente_endereco}}.\n\nOBJETO\n{{servicos}}\n\nVALOR E PAGAMENTO\n{{valor_e_pagamento}}\n\nVIGÊNCIA\n{{vigencia}}\n\n{{cidade}}, {{data_contrato}}.\n\nAs partes concordam com as condições acima e assinam eletronicamente.";
const labels = signerRoles;
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="contract-field">
      <span>{label}</span>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(/R\$/.test(label) ? money(String(Number(e.target.value.replace(/\D/g,""))/100)) : e.target.value)}
        onBlur={() => { if (/R\$|valor|mensalidade/i.test(label) && value) onChange(money(value)); }}
      />
    </label>
  );
}
export function ContractsModule() {
  const loadRevision=useRef(0);
  const editor = useRef<HTMLTextAreaElement>(null);
  const templateForm = useRef<HTMLFormElement>(null);
  const openedContractLink = useRef("");
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  useEffect(()=>{if(templateEditorOpen)templateForm.current?.scrollIntoView?.({behavior:"smooth",block:"start"});},[templateEditorOpen,editingTemplateId]);
  const [customKey, setCustomKey] = useState("");
  function insertField(key: string) {
    const field = key
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");
    if (!field) return;
    const el = editor.current;
    const start = el?.selectionStart ?? model.body.length,
      end = el?.selectionEnd ?? start;
    setModel((m) => ({
      ...m,
      body: m.body.slice(0, start) + `{{${field}}}` + m.body.slice(end),
    }));
    el?.focus();
  }
  const [profile, setProfile] = useState(defaults),
    [templates, setTemplates] = useState<ContractTemplate[]>([]),
    [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [tab, setTab] = useState("documents"),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [model, setModel] = useState({ name: "", body: example }),
    [templateId, setTemplateId] = useState(""),
    [title, setTitle] = useState("");
  const [client, setClient] = useState(initialClient),
    [values, setValues] = useState<Record<string, string>>({}),
    [signers, setSigners] = useState(defaultSigners);
  const [signNow, setSignNow] = useState(false);
  const [personType, setPersonType] = useState("juridica");
  const [issuerType, setIssuerType] = useState("juridica");
  const [selected, setSelected] = useState<ContractDocument | null>(null);
  const load = useCallback(async () => {
    const request=++loadRevision.current;
    try {
      const r = await fetch("/api/clientes/contratos", {cache:"no-store"});
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if(request!==loadRevision.current)return;
      setProfile(j.profile ?? defaults);
      setTemplates(j.templates ?? []);
      setDocuments(j.documents ?? []);
      setError("");
    } catch (e) {
      if(request===loadRevision.current)setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      if(request===loadRevision.current)setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setSelected((current) =>
      current ? (documents.find((d) => d.id === current.id) ?? null) : null,
    );
  }, [documents]);
  useEffect(() => {
    setSigners(items => {
      const primaryClient=items.findIndex(s=>s.role === "cliente");
      const primaryIssuer=items.findIndex(s=>s.role === "contratada");
      return items.map((s,i)=>i === primaryIssuer ? {...s,name:profile.name,document:profile.document} : i === primaryClient ? {...s,name:client.name,document:client.document,email:client.email} : s);
    });
  }, [profile.name, profile.document, client.name, client.document, client.email]);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get("contract");
    if(!id || openedContractLink.current===id)return;
    const doc=documents.find(d=>d.id===id);
    if(doc){openedContractLink.current=id;setTab("documents");setSelected(doc);}
  },[documents]);
  const detailsOpen = Boolean(selected);
  useEffect(() => {
    if (tab !== "documents" && !detailsOpen) return;
    let running = false;
    const refresh = () => {
      if (window.document.visibilityState === "hidden" || running) return;
      running = true; void load().finally(()=>{running=false;});
    };
    const timer = window.setInterval(refresh, 4000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus",refresh); };
  }, [tab, detailsOpen, load]);
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const customFields = useMemo(
    () =>
      templateFields(selectedTemplate?.body ?? "").filter(
        (k) =>
          !k.startsWith("testemunha") && !/^(?:cliente|contratante)_\d+_(?:nome|documento|cpf|cnpj|email)$/.test(k) && ![
            "contratada_nome",
            "contratada_documento",
            "contratada_endereco",
            "cliente_nome",
            "cliente_documento",
            "cliente_endereco",
            "cliente_email",
            "cliente_telefone",
            "cliente_qualificacao",
            "contratada_qualificacao",
          ].includes(k),
      ),
    [selectedTemplate],
  );
  const resolvedValues = derivedFields(selectedTemplate?.body ?? "", values, signers);
  const groups = Array.from(new Set(customFields.map(fieldGroup)));
  const preview = useMemo(() => {
    try {
      return renderContract(selectedTemplate?.body ?? "", {
        ...derivedFields(selectedTemplate?.body ?? "", values, signers),
        contratada_nome: profile.name,
        contratada_documento: profile.document,
        contratada_endereco: profile.address,
        cliente_nome: client.name,
        cliente_documento: client.document,
        cliente_endereco: client.address,
        cliente_email: client.email,
        cliente_telefone: client.phone,
        cliente_qualificacao: qualification(client.name, client.document, client.address),
        contratada_qualificacao: qualification(profile.name, profile.document, profile.address),
      });
    } catch {
      return "Preencha os campos para visualizar o contrato completo.";
    }
  }, [selectedTemplate, profile, client, values, signers]);
  async function save(body: Record<string, unknown>) {
    loadRevision.current++;
    setBusy(true);
    try {
      const r = await fetch("/api/clientes/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if(body.action==='delete'){setDocuments(rows=>rows.filter(d=>d.id!==body.id));setSelected(null);}
      await load();
      toast.success(body.action==='delete' ? "Contrato excluído" : "Salvo com sucesso");
      if (body.action === "issue") {
        if (signNow && j.signing_url) window.location.assign(j.signing_url);
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file: File) {
    setBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const r = await fetch("/api/clientes/contratos/importar", {
        method: "POST",
        body: data,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setModel((m) => ({
        name: m.name || file.name.replace(/\.[^.]+$/, ""),
        body: j.text,
      }));
      toast.success(
        "Texto importado. Revise a formatação e marque os campos personalizados.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação");
    } finally {
      setBusy(false);
    }
  }
  async function download(doc: ContractDocument) {
    setBusy(true);
    try {
      await downloadContract(doc);
    } catch {
      toast.error("Não foi possível exportar o PDF");
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  return (
    <section className="contracts-module">
      <header className="contract-section-head">
        <div>
          <span className="contract-kicker">DO MODELO À ASSINATURA</span>
          <h2>
            <FileSignature size={22} /> Contratos
          </h2>
          <p>
            Prepare o documento, compartilhe os links e acompanhe cada
            assinatura.
          </p>
        </div>
        <button className="contract-primary" onClick={() => setTab("new")}>
          <Plus size={16} /> Gerar contrato
        </button>
      </header>
      <button disabled={busy} onClick={() => void load()}>
        Atualizar assinaturas
      </button>
      <nav className="contract-tabs" aria-label="Contratos">
        {[
          ["documents", "Contratos"],
          ["new", "Gerar contrato"],
          ["templates", "Modelos"],
          ["profile", "Meus dados"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <div role="alert" className="contract-error">
          {error}
          <button onClick={() => void load()}>Tentar novamente</button>
        </div>
      )}
      {tab === "profile" && (
        <form
          className="contract-box contract-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await save({ action: "profile", ...profile });
          }}
        >
          <h3>Dados da contratada</h3>
          <p>
            Preenchidos automaticamente nos próximos contratos. Endereço é
            opcional.
          </p>
          <Field
            required
            label="Nome / Razão social"
            value={profile.name}
            onChange={(name) => setProfile((p) => ({ ...p, name }))}
          />
          <Field
            required
            label="CPF / CNPJ"
            value={profile.document}
            onChange={(document) => setProfile((p) => ({ ...p, document }))}
          />
          <Field
            label="Endereço (opcional)"
            value={profile.address}
            onChange={(address) => setProfile((p) => ({ ...p, address }))}
          />
          <button disabled={busy} className="contract-primary">
            Salvar meus dados
          </button>
        </form>
      )}
      {tab === "templates" && <>
        <section className="contract-template-library">
          <header className="contract-section-head"><div><h3>Modelos existentes ({templates.length})</h3><p>Visualize um modelo ou edite o conteúdo usado nos próximos contratos.</p></div><button className="contract-primary" onClick={()=>{setEditingTemplateId("");setModel({name:"",body:example});setTemplateEditorOpen(true);}}><Plus size={16}/> Novo modelo</button></header>
          {!templates.length && <div className="contract-box"><p>Nenhum modelo salvo. Crie ou importe seu primeiro modelo.</p></div>}
          {templates.map(t=><article className="contract-box contract-template-card" key={t.id}><header className="contract-section-head"><div><h3>{t.name}</h3><p>{templateFields(t.body).length} campos de preenchimento</p></div><button className="contract-chip" onClick={()=>{setEditingTemplateId(t.id);setModel({name:t.name,body:t.body});setTemplateEditorOpen(true);}}>Editar modelo</button></header><details><summary>Visualizar modelo</summary><ContractPaper document={{title:t.name,body:t.body}}/></details></article>)}
        </section>
        {templateEditorOpen && <form ref={templateForm}
          className="contract-box contract-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await save({ action: "template", id: editingTemplateId || undefined, ...model })) {
              setModel({ name: "", body: example });setEditingTemplateId("");setTemplateEditorOpen(false);
            }
          }}
        >
          <header className="contract-section-head"><h3>{editingTemplateId ? `Editar modelo: ${model.name}` : "Novo modelo de contrato"}</h3><button type="button" onClick={()=>{setTemplateEditorOpen(false);setEditingTemplateId("");}}>Fechar editor</button></header><p>As alterações valem para novos contratos. Documentos já emitidos mantêm o conteúdo original.</p>
          <p>
            Importe um Word (.docx) ou texto (.txt), ou cole o contrato abaixo.
            A importação preserva o texto; revise a organização antes de salvar.
          </p>
          <label className="contract-file">
            Importar modelo
            <input
              type="file"
              accept=".txt,.docx"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <Field
            required
            label="Nome do modelo"
            value={model.name}
            onChange={(name) => setModel((m) => ({ ...m, name }))}
          />
          <div className="contract-box">
            <p>
              Posicione o cursor no texto ou selecione um trecho e escolha o
              campo para inserir.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "cliente_nome",
                "cliente_documento",
                "cliente_endereco",
                "contratada_nome",
                "contratada_documento",
                "contratada_endereco",
              ].map((key) => (
                <button
                  className="contract-chip"
                  key={key}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertField(key)}
                >
                  {fieldLabel(key)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <input
                className="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm"
                aria-label="Nome do campo personalizado"
                placeholder="Ex.: valor_mensal"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  insertField(customKey);
                  setCustomKey("");
                }}
              >
                Inserir campo personalizado
              </button>
            </div>
          </div>
          <label className="contract-field">
            <span>Texto do contrato</span>
            <textarea
              ref={editor}
              required
              rows={16}
              value={model.body}
              onChange={(e) =>
                setModel((m) => ({ ...m, body: e.target.value }))
              }
            />
          </label>
          <p>
            Use campos como <code>{"{{cliente_nome}}"}</code>,{" "}
            <code>{"{{cliente_documento}}"}</code>,{" "}
            <code>{"{{cliente_endereco}}"}</code>,{" "}
            <code>{"{{contratada_nome}}"}</code>,{" "}
            <code>{"{{contratada_documento}}"}</code> e{" "}
            <code>{"{{contratada_endereco}}"}</code>. Crie outros com{" "}
            <code>{"{{nome_do_campo}}"}</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            {templateFields(model.body).map((f) => (
              <span className="contract-chip" key={f}>
                {f}
              </span>
            ))}
          </div>
          <button disabled={busy} className="contract-primary">
            {editingTemplateId ? "Salvar alterações" : "Salvar modelo"}
          </button>
        </form>}
      </>}
      {tab === "new" && (
        <form
          className="contract-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await save({
                action: "issue",
                template_id: templateId,
                title,
                client: { ...client, monthly_fee: numeric(client.monthly_fee) },
                values: resolvedValues,
                signers,
                sign_now: signNow,
              })
            ) {
              setTab("documents");
              setClient(initialClient);
              setValues({});
              setTitle("");
              setSigners(defaultSigners().map(s => s.role === "contratada" ? {...s,name:profile.name,document:profile.document} : s));
            }
          }}
        >
          <div className="contract-box">
            <h3>1. Modelo e cliente</h3>
            {!templates.length && (
              <p>Salve um modelo na aba Modelos para começar.</p>
            )}
            {!profile.name && (
              <p>
                Salve seus dados na aba Meus dados antes de gerar o contrato.
              </p>
            )}
            <label className="contract-field">
              <span>Modelo</span>
              <select
                required
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  setValues({ ...savedLocation(), data_assinatura: today(), data_contrato: today() });
                }}
              >
                <option value="">Selecionar modelo</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              required
              label="Título do contrato"
              value={title}
              onChange={setTitle}
            />
            <details className="contract-qualification"><summary>Contratado · {profile.name || "Configurar meus dados"}</summary><select aria-label="Tipo de pessoa da contratada" value={issuerType} onChange={e=>setIssuerType(e.target.value)}><option value="fisica">Pessoa física</option><option value="juridica">Pessoa jurídica</option></select><p>{qualification(profile.name,profile.document,profile.address)}</p><button type="button" onClick={()=>setTab("profile")}>Editar dados da contratada</button></details>
            <details className="contract-qualification"><summary>Qualificação do cliente · {personType === "fisica" ? "Pessoa física" : "Pessoa jurídica"}</summary>
            <select aria-label="Tipo de cliente" value={personType} onChange={e=>setPersonType(e.target.value)}><option value="fisica">Pessoa física</option><option value="juridica">Pessoa jurídica</option></select>
            <div className="contract-grid">
              <label className="contract-field"><span>Tipo de Cliente</span><select value={client.company_type} onChange={e=>setClient(c=>({...c,company_type:e.target.value}))}>{CLIENT_COMPANY_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
              {(
                [
                  ["name", "Nome / Razão social"],
                  ["document", "CPF / CNPJ"],
                  ["contact_name", "Nome do contato"],
                  ["email", "E-mail"],
                  ["phone", "Celular"],
                  ["address", "Endereço (opcional)"],
                  ["monthly_fee", "Mensalidade do cliente (R$)"],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  required={["name", "document"].includes(key)}
                  label={key === "name" ? (personType === "fisica" ? "Nome completo" : "Razão social") : key === "document" ? (personType === "fisica" ? "CPF" : "CNPJ") : label}
                  type={
                    key === "email"
                      ? "email"
                      : key === "monthly_fee"
                        ? "text"
                        : "text"
                  }
                  value={client[key]}
                  onChange={(v) => {
                    setClient((c) => ({ ...c, [key]: v }));

                  }}
                />
              ))}
            </div>
            </details>
          </div>
          <div className="contract-box">
            <h3>2. Detalhes do contrato</h3>
            <p>Somente os campos utilizados neste modelo são solicitados. Os campos por extenso são calculados automaticamente.</p>
            {groups.map(group => <details key={group} className="contract-field-group" open={!/Qualificação|Testemunhas/.test(group)}>
              <summary>{group}</summary>
              {group === "Qualificação da contratada" && <select aria-label="Tipo de contratada" value={issuerType} onChange={e=>setIssuerType(e.target.value)}><option value="fisica">Pessoa física</option><option value="juridica">Pessoa jurídica</option></select>}
              {group === "Local e assinatura" && <button type="button" className="contract-chip" onClick={()=>{try { const local:Record<string,string>={}; customFields.filter(k=>fieldGroup(k)==="Local e assinatura" && !/data/.test(k)).forEach(k=>{local[k]=resolvedValues[k] || "";}); localStorage.setItem("contract-location",JSON.stringify(local)); toast.success("Local padrão salvo neste navegador"); } catch { toast.error("Não foi possível salvar o padrão"); }}}>Salvar local como padrão</button>}
              <div className="contract-grid">{customFields.filter(key=>fieldGroup(key)===group).map(key => <label className="contract-field" key={key}>
                <span>{fieldLabel(key)}</span>
                <input required={!key.endsWith("_endereco") && !key.startsWith("testemunha") && !/(?:^|_)email(?:_|$)/.test(key)} readOnly={key.includes("extenso")} value={resolvedValues[key] ?? ""}
                  onBlur={()=>{ if(isMoney(key) && values[key]) setValues(p=>({...p,[key]:money(p[key])})); }}
                  onChange={e=>{ const v=isMoney(key) ? money(String(Number(e.target.value.replace(/\D/g,""))/100)) : e.target.value; setValues(p=>({...p,[key]:v}));  }} />
              </label>)}</div>
            </details>)}
            {!customFields.length && (
              <p>
                Os campos do modelo serão preenchidos com os dados das partes.
              </p>
            )}
          </div>
          <div className="contract-box">
            <h3>3. Quem assina</h3>
            <p>
              Todas as pessoas da lista precisam assinar. Nome e CPF das testemunhas podem ser preenchidos por elas ao assinar. Cada pessoa recebe um link próprio para ler e assinar. E-mail é opcional; quando informado, a assinatura será confirmada por código. Sem e-mail, o aceite será registrado pelo link privado.
            </p>
            <p>Use “Adicionar contratante” para incluir outras pessoas que assinam como clientes. Cada uma terá seus próprios dados e link de assinatura.</p>
            {signers.map((s, i) => (
              <div key={i} className="contract-signer-card">
              <h4>{s.role === "cliente" ? `Contratante ${signers.slice(0,i+1).filter(x=>x.role === "cliente").length}${i === signers.findIndex(x=>x.role === "cliente") ? " · Principal" : ""}` : labels[s.role]}</h4>
              <div className="contract-signer-row">
                <Field
                  required={s.role !== "testemunha"}
                  label={s.role === "testemunha" ? "Nome da Testemunha (opcional)" : "Nome"}
                  placeholder={s.role === "testemunha" ? "Ela informará ao assinar" : undefined}
                  value={s.name}
                  onChange={(v) =>
                    setSigners((a) =>
                      a.map((x, j) => (j === i ? { ...x, name: v } : x)),
                    )
                  }
                />
                <Field
                  label="E-mail (opcional)"
                  type="email"
                  value={s.email}
                  onChange={(v) =>
                    setSigners((a) =>
                      a.map((x, j) => (j === i ? { ...x, email: v } : x)),
                    )
                  }
                />
                <Field required={s.role === "cliente"} label="CPF / CNPJ" value={s.document} onChange={v=>setSigners(a=>a.map((x,j)=>j===i?{...x,document:v}:x))}/>
                <label className="contract-field">
                  <span>Papel</span>
                  <select
                    value={s.role}
                    disabled={s.role === "cliente" && i === signers.findIndex(x=>x.role === "cliente")}
                    onChange={(e) =>
                      setSigners((a) =>
                        a.map((x, j) =>
                          j === i
                            ? { ...x, role: e.target.value as ContractRole, ...(e.target.value === "contratada" ? {name:profile.name,document:profile.document} : e.target.value === "cliente" && !a.some((other,index)=>index!==i && other.role === "cliente") ? {name:client.name,document:client.document,email:client.email} : {}) }
                            : x,
                        ),
                      )
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {labels[r]}
                      </option>
                    ))}
                  </select>
                </label>
                {i > 0 && !(s.role === "cliente" && i === signers.findIndex(x=>x.role === "cliente")) && (
                  <button
                    type="button"
                    aria-label="Remover assinador"
                    onClick={() =>
                      setSigners((a) => a.filter((_, j) => j !== i))
                    }
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              </div>
            ))}
            <button type="button" className="contract-chip" disabled={signers.length >= 20} onClick={()=>setSigners(items=>[...items,{name:"",email:"",document:"",role:"cliente"}])}><Plus size={16}/> Adicionar contratante</button>
            <button
              type="button"
              disabled={signers.length >= 20}
              onClick={() =>
                setSigners((s) => [
                  ...s,
                  { name: "", email: "", document: "", role: "testemunha" },
                ])
              }
            >
              <Plus size={16} /> Adicionar assinador
            </button>
          </div>
          {selectedTemplate && (
            <details className="contract-box">
              <summary>Conferir prévia do documento</summary>
              <ContractPaper document={{title,body:preview}} />
            </details>
          )}
          <label className="contract-consent"><input type="checkbox" checked={signNow} onChange={e=>setSignNow(e.target.checked)} /><span>Quero assinar como contratada assim que gerar o contrato</span></label>
          <p className="contract-hint">
            Depois de gerar, o texto e os assinadores ficam fixos. Para
            corrigir, cancele e gere outro contrato. Os links expiram em 30
            dias. O cliente será cadastrado após todas as assinaturas.
          </p>
          <button
            className="contract-primary"
            disabled={busy || !templateId || !profile.name}
          >
            {busy ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <FileSignature size={16} />
            )}{" "}
            Gerar contrato e links de assinatura
          </button>
        </form>
      )}
      {tab === "documents" && (
        <div className="contract-list">
          {!documents.length && (
            <div className="contract-box contract-empty">
              <FileSignature size={36} />
              <h3>Seu próximo cliente começa aqui</h3>
              <p>
                Salve seus dados, adicione um modelo e gere o primeiro contrato.
              </p>
              <button onClick={() => setTab("profile")}>
                Configurar meus dados
              </button>
            </div>
          )}
          {documents.map((d) => (
            <button
              className="contract-box contract-list-item"
              key={d.id}
              onClick={() => setSelected(d)}
            >
              <div>
                <h3>{d.title}</h3>
                <p>
                  {d.client_data.name} ·{" "}
                  {new Date(d.created_at).toLocaleDateString("pt-BR")}
                </p>
                <small>
                  {d.signers.filter((s) => s.signed_at).length} de{" "}
                  {d.signers.length} assinaturas
                </small>
              </div>
              <span className={`contract-status ${d.status}`}>
                {d.status === "signed"
                  ? (d.client_id ? "Assinado · Cliente cadastrado" : "Assinado · Cliente removido")
                  : d.status === "cancelled"
                    ? "Cancelado"
                    : new Date(d.expires_at) < new Date()
                      ? "Link expirado"
                      : "Assinatura Pendente"}
              </span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="contract-overlay">
          <section
            className="contract-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do contrato"
          >
            <header className="contract-section-head">
              <h3>{selected.title}</h3>
              <button
                aria-label="Fechar detalhes"
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            </header>
            <p className="contract-hint">
              Links privados: compartilhe cada link somente com o assinador
              correspondente. Validade:{" "}
              {new Date(selected.expires_at).toLocaleDateString("pt-BR")}.
            </p>
            {selected.signers.map((s) => (
              <div className="contract-signature-item" key={s.id}>
                <div>
                  <strong>{s.signed_name || s.name}</strong>
                  <p>
                    {labels[s.role]} · {s.email}
                  </p>
                  <small>
                    {s.signed_at
                      ? `Assinado em ${new Date(s.signed_at).toLocaleString("pt-BR")}`
                      : "Aguardando assinatura"}
                  </small>
                </div>
                {s.signed_at ? (
                  <CheckCircle2 size={20} />
                ) : (
                  selected.status === "pending" && (
                    <div className="flex gap-3">{s.role === "contratada" && <a className="contract-chip" href={s.url}>Assinar agora</a>}<button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(s.url ?? "");
                          toast.success("Link copiado");
                        } catch {
                          toast.error("Não foi possível copiar o link");
                        }
                      }}
                    >
                      <Copy size={15} /> Copiar link
                    </button></div>
                  )
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-3 my-4">
              <button disabled={busy} onClick={() => void download(selected)}>
                <Download size={16} /> Baixar contrato em PDF
              </button>
              <button disabled={busy} className="text-rose-400" onClick={async()=>{if(window.confirm("Excluir permanentemente este contrato e seus registros de assinatura? Os links deixarão de funcionar. Caso já exista um cliente cadastrado, ele será mantido.")){if(await save({action:"delete",id:selected.id}))setSelected(null);}}}><Trash2 size={16}/> Excluir contrato</button>
              {selected.status === "pending" && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (
                      window.confirm(
                        "Cancelar este contrato e invalidar todos os links?",
                      )
                    ) {
                      if (await save({ action: "cancel", id: selected.id }))
                        setSelected(null);
                    }
                  }}
                >
                  Cancelar contrato
                </button>
              )}
            </div>
<details className="contract-box"><summary>Expandir prévia do contrato</summary><ContractPaper document={selected} /></details>
            <p className="contract-hash">SHA-256 · {selected.content_hash}</p>
          </section>
        </div>
      )}
    </section>
  );
}
