import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { ContractsModule } from "../ContractsModule";
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
it("shows pending contracts, per-signer links and configurable template fields", async () => {
  vi.useFakeTimers();
  vi.spyOn(document,"visibilityState","get").mockReturnValue("visible");
  let signed = false;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        profile: {
          name: "Genesy Company",
          document: "12.345.678/0001-99",
          address: "Fortaleza, CE",
        },
        templates: [
          {
            id: "template",
            name: "Prestação de serviços",
            body: "CONTRATO\n\n{{contratada_nome}} e {{cliente_nome}}\n{{servicos}}\n{{comissao_percentual}} {{comissao_por_extenso}} {{vigencia_meses}} {{vigencia_por_extenso}} {{vigencia_meses}} {{testemunha_1_nome}} {{testemunha_1_cpf}} {{testemunha_2_nome}} {{data_assinatura_por_extenso}} {{foro_cidade}} {{uf_assinatura}}",
          },
        ],
        documents: [
          {
            id: "doc",
            title: "Contrato de Gestão de Marketing",
            body: "CONTRATO\n\nCONTRATADA: Genesy Company.\nCONTRATANTE: Villa Real Empreendimentos.\n\nOBJETO\nGestão de campanhas e relacionamento.\n\nVIGÊNCIA\n12 meses.",
            content_hash: "f".repeat(64),
            status: "pending",
            created_at: "2026-11-05",
            expires_at: "2026-12-05",
            client_data: { name: "Villa Real Empreendimentos" },
            signers: [
              {
                id: "s1",
                name: "Maria Silva",
                email: "maria@example.com",
                role: "cliente",
                signed_at: signed ? "2026-11-06T15:00:00Z" : null,
                signed_name: signed ? "Maria Silva" : undefined,
                signed_document: signed ? "12345678901" : undefined,
                url: "https://example.com/sign",
              },
              {
                id: "s2",
                name: "Ana Souza",
                email: "ana@example.com",
                role: "testemunha",
                signed_at: null,
              },
            ],
          },
        ],
      }),
    ),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const snapshot = (name: string) => {
    if (!process.env.CONTRACT_UI_PREVIEW) return;
    mkdirSync("/tmp/contracts-preview", { recursive: true });
    const clone = host.cloneNode(true) as HTMLElement;
    host.querySelectorAll("select").forEach((select,i)=> { Array.from(clone.querySelectorAll("select")[i].options).forEach(option=>{ if(option.value===select.value) option.setAttribute("selected",""); else option.removeAttribute("selected"); }); });
    writeFileSync(
      `/tmp/contracts-preview/${name}.html`,
      `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${readFileSync("src/components/clientes/contracts.css", "utf8")}body{margin:0;padding:24px;font-family:Arial;background:#101115;--bg-modal:#191a1e;--text-title:#ececf0;--muted-foreground:#9c9da5;--border:#ffffff18;--hover:#ffffff09;--input:#202126}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer;background:none;border:0}*{box-sizing:border-box}svg{vertical-align:middle} .contract-primary{background:linear-gradient(120deg,#e7e8eb,#adb1b9)!important;color:#15171b} </style><body>${clone.innerHTML}</body></html>`,
    );
  };
  try {
    await act(async () => root.render(createElement(ContractsModule)));
    expect(host.textContent).toContain("Assinatura Pendente");
    snapshot("contracts");
    await act(async () =>
      host.querySelector<HTMLButtonElement>(".contract-list-item")!.click(),
    );
    expect(host.textContent).toContain("Copiar link");
    expect(host.textContent).toContain("Testemunha");
    snapshot("details");
    await act(async()=>{signed=true;await vi.advanceTimersByTimeAsync(4000);});
    expect(host.textContent).toContain("Assinado em");
    expect(host.querySelector('.contract-signing-seal')?.textContent).toContain('Código da assinatura: s1');
    expect(host.querySelector('.contract-document-header')).not.toBeNull();
    snapshot('details-signed');
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="Fechar detalhes"]')!
        .click(),
    );
    const models = Array.from(host.querySelectorAll("nav button")).find(
      (b) => b.textContent === "Modelos",
    ) as HTMLButtonElement;
    await act(async () => models.click());
    expect(host.textContent).toContain("Modelos existentes (1)");
    expect(host.querySelector("textarea")).toBeNull();
    expect(host.querySelector(".contract-template-card")?.textContent).toContain("Prestação de serviços");
    snapshot("model-library");
    const edit=Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(b=>b.textContent === "Editar modelo")!;
    await act(async()=>edit.click());
    expect(host.querySelector("textarea")?.value).toContain("{{cliente_nome}}");
    expect(host.textContent).toContain("Salvar alterações");
    expect(host.textContent).toContain("Inserir campo personalizado");
    snapshot("models");
    const newTab = Array.from(host.querySelectorAll("nav button")).find(b=>b.textContent === "Gerar contrato") as HTMLButtonElement;
    await act(async()=>newTab.click());
    const choose=host.querySelector<HTMLSelectElement>('.contract-field select')!;
    await act(async()=>{choose.value="template";choose.dispatchEvent(new Event("change",{bubbles:true}));});
    expect(host.querySelectorAll('.contract-signer-row')).toHaveLength(4);
    const witnessNames=host.querySelectorAll<HTMLInputElement>('input[placeholder="Ela informará ao assinar"]');
    expect(witnessNames).toHaveLength(2);
    expect(Array.from(witnessNames).every(input=>!input.required && !input.value)).toBe(true);
    expect(Array.from(host.querySelectorAll('.contract-field-group summary')).some(el=>el.textContent === 'Testemunhas')).toBe(false);
    expect(host.querySelectorAll('input[readonly]')).not.toHaveLength(0);
    const inputFor=(text:string)=>Array.from(host.querySelectorAll<HTMLLabelElement>('label.contract-field')).find(el=>el.querySelector('span')?.textContent===text)!.querySelector('input')!;
    expect(inputFor('Foro Cidade').value).toBe('João Pessoa');
    expect(inputFor('Data Assinatura por Extenso').value).toContain(' de ');
    const fill = async (el:HTMLInputElement,value:string)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});
    await fill(inputFor('Comissão Percentual'),'5');
    await fill(inputFor('Vigência Meses'),'3');
    expect(inputFor('Comissão por Extenso').value).toBe('cinco');
    expect(inputFor('Vigência por Extenso').value).toBe('três');
    await fill(inputFor('Razão social'),'Cliente exemplo');
    await fill(inputFor('CNPJ'),'12345678000199');
    const rows=host.querySelectorAll('.contract-signer-row');
    expect(Array.from(rows).map(row=>row.querySelector('select')!.value)).toEqual(['contratada','cliente','testemunha','testemunha']);
    expect(rows[0].querySelector('input')!.value).toBe('Genesy Company');
    expect(rows[1].querySelector('input')!.value).toBe('Cliente exemplo');
    expect(rows[1].querySelectorAll('input')[2].value).toBe('12345678000199');
    expect(host.querySelectorAll('input[type="email"][required]')).toHaveLength(0);
    snapshot("new");

  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});
