import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { ErroFerramenta, type McpFerramenta } from "./protocol";

// ─────────────────────────────────────────────────────────────────────────────
// Ferramentas do módulo Financeiro (tabelas revenues e expenses, as mesmas das
// abas Receitas e Despesas). Sem exclusão: apagar continua só pela plataforma.
// ─────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const ASSINATURA = "Lançado pela IA (conector Genesy).";

export const TIPOS_RECEITA = ["mensalidade", "setup", "extra", "consultoria", "outro"] as const;
export const STATUS_RECEITA = ["pago", "pendente", "atrasado", "cancelado"] as const;
export const FORMAS_PAGAMENTO = ["pix", "boleto", "cartao", "ted", "dinheiro", "outro"] as const;
export const CATEGORIAS_DESPESA = ["freelancers", "equipe", "ferramentas", "impostos", "operacional", "marketing", "trafego_pago", "outros"] as const;
export const TIPOS_DESPESA = ["fixa", "variavel"] as const;

/** Hoje no fuso da agência (João Pessoa). */
export function hojeFortaleza(agora = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
}

export function dataValida(v: string): boolean {
  if (!DATA.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Valor em reais: positivo, no máximo 2 casas, até R$ 10 milhões. Aceita "1.234,56". */
export function lerValor(v: unknown): number {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string" && /^\s*\d{1,3}(\.\d{3})*(,\d{1,2})?\s*$|^\s*\d+([.,]\d{1,2})?\s*$/.test(v)) {
    const s = v.trim();
    const brasileiro = s.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(s);
    n = Number(brasileiro ? s.replace(/\./g, "").replace(",", ".") : s);
  } else throw new ErroFerramenta('"valor" precisa ser um número em reais, ex.: 1500 ou 1500.50.');
  if (!Number.isFinite(n) || n <= 0) throw new ErroFerramenta('"valor" precisa ser maior que zero.');
  if (n > 10_000_000) throw new ErroFerramenta('"valor" acima de R$ 10 milhões: confira o número.');
  if (Math.round(n * 100) !== Number((n * 100).toFixed(6))) throw new ErroFerramenta('"valor" tem mais de 2 casas decimais.');
  return Math.round(n * 100) / 100;
}

export function intervaloDoMes(mes: string): { inicio: string; fim: string } {
  if (!MES.test(mes)) throw new ErroFerramenta('"mes" precisa estar no formato AAAA-MM.');
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

function texto(args: Record<string, unknown>, campo: string, max: number, obrigatorio = false): string | undefined {
  const v = args[campo];
  if (v === undefined || v === null || v === "") {
    if (obrigatorio) throw new ErroFerramenta(`Informe "${campo}".`);
    return undefined;
  }
  if (typeof v !== "string") throw new ErroFerramenta(`"${campo}" precisa ser texto.`);
  const limpo = v.trim();
  if (limpo.length > max) throw new ErroFerramenta(`"${campo}" passa de ${max} caracteres.`);
  if (!limpo && obrigatorio) throw new ErroFerramenta(`Informe "${campo}".`);
  return limpo || undefined;
}
function opcao<T extends string>(args: Record<string, unknown>, campo: string, opcoes: readonly T[], padrao?: T): T | undefined {
  const v = args[campo];
  if (v === undefined || v === null || v === "") return padrao;
  if (typeof v !== "string" || !(opcoes as readonly string[]).includes(v)) {
    throw new ErroFerramenta(`"${campo}" precisa ser um de: ${opcoes.join(", ")}.`);
  }
  return v as T;
}
function data(args: Record<string, unknown>, campo: string, padrao?: string): string | undefined {
  const v = texto(args, campo, 10);
  if (!v) return padrao;
  if (!dataValida(v)) throw new ErroFerramenta(`"${campo}" precisa ser uma data válida no formato AAAA-MM-DD.`);
  return v;
}
function id(args: Record<string, unknown>, campo: string, obrigatorio = false): string | undefined {
  const v = texto(args, campo, 36, obrigatorio);
  if (v && !UUID.test(v)) throw new ErroFerramenta(`"${campo}" não é um id válido.`);
  return v;
}
function notas(args: Record<string, unknown>): string {
  const n = texto(args, "notas", 1000);
  return n ? `${n}\n\n${ASSINATURA}` : ASSINATURA;
}

async function conferirCliente(ownerId: string, clienteId: string | undefined): Promise<string | null> {
  if (!clienteId) return null;
  const { data: c, error } = await createAdminSupabaseClient().from("agency_clients")
    .select("name").eq("user_id", ownerId).eq("id", clienteId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new ErroFerramenta("Cliente não encontrado. Use listar_clientes para ver os ids.");
  return (c as { name: string }).name;
}

const CAMPOS_RECEITA = "id,client_id,type,description,amount,date,due_date,paid_date,payment_method,status,notes,created_at";
const CAMPOS_DESPESA = "id,client_id,category,description,amount,date,type,cost_center,notes,created_at";

export const FERRAMENTAS_FINANCEIRO: McpFerramenta[] = [
  {
    name: "registrar_receita",
    title: "Registrar receita (entrada)",
    description: "Lança uma entrada na aba Receitas do Financeiro. Use só quando o Lancaster pedir, e confirme com ele valor, data e cliente antes de lançar. Para cobrança ainda não paga, use status pendente com vencimento.",
    inputSchema: {
      type: "object",
      properties: {
        descricao: { type: "string", description: "Ex.: \"Mensalidade novembro · Luna\"." },
        valor: { type: "number", description: "Em reais, ex.: 2500 ou 2500.50." },
        data: { type: "string", description: "Data da receita, AAAA-MM-DD. Padrão: hoje." },
        status: { type: "string", enum: [...STATUS_RECEITA], description: "Padrão: pago." },
        vencimento: { type: "string", description: "AAAA-MM-DD, para receitas pendentes." },
        data_pagamento: { type: "string", description: "AAAA-MM-DD. Padrão para status pago: a data da receita." },
        tipo: { type: "string", enum: [...TIPOS_RECEITA], description: "Padrão: mensalidade se tiver cliente, senão outro." },
        forma_pagamento: { type: "string", enum: [...FORMAS_PAGAMENTO], description: "Padrão: pix." },
        cliente_id: { type: "string", description: "Opcional: id do cliente (de listar_clientes)." },
        notas: { type: "string" },
      },
      required: ["descricao", "valor"],
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const descricao = texto(args, "descricao", 200, true) as string;
      const valor = lerValor(args.valor);
      const dia = data(args, "data", hojeFortaleza()) as string;
      const status = opcao(args, "status", STATUS_RECEITA, "pago") as string;
      const vencimento = data(args, "vencimento");
      const clienteId = id(args, "cliente_id");
      const tipo = opcao(args, "tipo", TIPOS_RECEITA, clienteId ? "mensalidade" : "outro");
      const forma = opcao(args, "forma_pagamento", FORMAS_PAGAMENTO, "pix");
      const pagoEm = status === "pago" ? data(args, "data_pagamento", dia) : null;
      if (status !== "pago" && args.data_pagamento) throw new ErroFerramenta('"data_pagamento" só vale para status pago.');
      const cliente = await conferirCliente(ctx.ownerId, clienteId);
      const { data: r, error } = await createAdminSupabaseClient().from("revenues").insert({
        user_id: ctx.ownerId, client_id: clienteId ?? null, type: tipo, description: descricao, amount: valor,
        date: dia, due_date: vencimento ?? null, paid_date: pagoEm, payment_method: forma, status,
        is_recurring: false, notes: notas(args),
      }).select(CAMPOS_RECEITA).single();
      if (error) throw new Error(error.message);
      return { receita: { ...r, cliente } };
    },
  },
  {
    name: "registrar_despesa",
    title: "Registrar despesa (saída)",
    description: "Lança uma saída na aba Despesas do Financeiro. Use só quando o Lancaster pedir, e confirme com ele valor, data e categoria antes de lançar.",
    inputSchema: {
      type: "object",
      properties: {
        descricao: { type: "string", description: "Ex.: \"Canva Pro · novembro\"." },
        valor: { type: "number", description: "Em reais." },
        data: { type: "string", description: "AAAA-MM-DD. Padrão: hoje." },
        categoria: { type: "string", enum: [...CATEGORIAS_DESPESA], description: "Padrão: outros." },
        tipo: { type: "string", enum: [...TIPOS_DESPESA], description: "fixa (todo mês) ou variavel. Padrão: variavel." },
        centro_de_custo: { type: "string", description: "Opcional." },
        cliente_id: { type: "string", description: "Opcional: quando a despesa é de um cliente (ex.: verba de tráfego)." },
        notas: { type: "string" },
      },
      required: ["descricao", "valor"],
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const descricao = texto(args, "descricao", 200, true) as string;
      const valor = lerValor(args.valor);
      const dia = data(args, "data", hojeFortaleza()) as string;
      const categoria = opcao(args, "categoria", CATEGORIAS_DESPESA, "outros");
      const tipo = opcao(args, "tipo", TIPOS_DESPESA, "variavel");
      const centro = texto(args, "centro_de_custo", 80);
      const clienteId = id(args, "cliente_id");
      const cliente = await conferirCliente(ctx.ownerId, clienteId);
      const { data: d, error } = await createAdminSupabaseClient().from("expenses").insert({
        user_id: ctx.ownerId, client_id: clienteId ?? null, category: categoria, description: descricao, amount: valor,
        date: dia, type: tipo, cost_center: centro ?? null, auto_imported: false, notes: notas(args),
      }).select(CAMPOS_DESPESA).single();
      if (error) throw new Error(error.message);
      return { despesa: { ...d, cliente } };
    },
  },
  {
    name: "marcar_receita_paga",
    title: "Marcar receita como paga",
    description: "Dá baixa numa receita pendente ou atrasada (ex.: o cliente pagou a mensalidade). Use listar_financeiro para achar o id.",
    inputSchema: {
      type: "object",
      properties: {
        receita_id: { type: "string" },
        data_pagamento: { type: "string", description: "AAAA-MM-DD. Padrão: hoje." },
        forma_pagamento: { type: "string", enum: [...FORMAS_PAGAMENTO] },
      },
      required: ["receita_id"],
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const receitaId = id(args, "receita_id", true) as string;
      const pagoEm = data(args, "data_pagamento", hojeFortaleza()) as string;
      const forma = opcao(args, "forma_pagamento", FORMAS_PAGAMENTO);
      const db = createAdminSupabaseClient();
      const { data: atual, error: erroLeitura } = await db.from("revenues").select("id,status")
        .eq("user_id", ctx.ownerId).eq("id", receitaId).maybeSingle();
      if (erroLeitura) throw new Error(erroLeitura.message);
      if (!atual) throw new ErroFerramenta("Receita não encontrada.");
      const st = (atual as { status: string }).status;
      if (st === "pago") throw new ErroFerramenta("Essa receita já está paga.");
      if (st === "cancelado") throw new ErroFerramenta("Essa receita está cancelada; reative pela plataforma se for o caso.");
      const { data: r, error } = await db.from("revenues")
        .update({ status: "pago", paid_date: pagoEm, ...(forma ? { payment_method: forma } : {}) })
        .eq("user_id", ctx.ownerId).eq("id", receitaId).select(CAMPOS_RECEITA).single();
      if (error) throw new Error(error.message);
      return { receita: r };
    },
  },
  {
    name: "listar_financeiro",
    title: "Ver o financeiro do mês",
    description: "Receitas e despesas de um mês, com totais: recebido, a receber, despesas e resultado (recebido − despesas). Use antes de lançar, para não duplicar.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        mes: { type: "string", description: "AAAA-MM. Padrão: mês atual." },
        tipo: { type: "string", enum: ["receitas", "despesas", "ambos"], description: "Padrão: ambos." },
        cliente_id: { type: "string", description: "Opcional: só deste cliente." },
      },
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const mes = texto(args, "mes", 7) ?? hojeFortaleza().slice(0, 7);
      const { inicio, fim } = intervaloDoMes(mes);
      const tipo = opcao(args, "tipo", ["receitas", "despesas", "ambos"] as const, "ambos");
      const clienteId = id(args, "cliente_id");
      const db = createAdminSupabaseClient();
      let receitas: Record<string, unknown>[] = [];
      let despesas: Record<string, unknown>[] = [];
      if (tipo !== "despesas") {
        let q = db.from("revenues").select(CAMPOS_RECEITA).eq("user_id", ctx.ownerId).gte("date", inicio).lte("date", fim)
          .order("date", { ascending: true }).limit(300);
        if (clienteId) q = q.eq("client_id", clienteId);
        const { data: r, error } = await q;
        if (error) throw new Error(error.message);
        receitas = (r ?? []) as Record<string, unknown>[];
      }
      if (tipo !== "receitas") {
        let q = db.from("expenses").select(CAMPOS_DESPESA).eq("user_id", ctx.ownerId).gte("date", inicio).lte("date", fim)
          .order("date", { ascending: true }).limit(300);
        if (clienteId) q = q.eq("client_id", clienteId);
        const { data: d, error } = await q;
        if (error) throw new Error(error.message);
        despesas = (d ?? []) as Record<string, unknown>[];
      }
      return { mes, ...totais(receitas, despesas), receitas, despesas };
    },
  },
];

export function totais(receitas: Record<string, unknown>[], despesas: Record<string, unknown>[]) {
  const soma = (xs: Record<string, unknown>[]) => Math.round(xs.reduce((t, x) => t + Number(x.amount ?? 0), 0) * 100) / 100;
  const recebido = soma(receitas.filter((r) => r.status === "pago"));
  const aReceber = soma(receitas.filter((r) => r.status === "pendente" || r.status === "atrasado"));
  const totalDespesas = soma(despesas);
  return {
    totais: { recebido, a_receber: aReceber, despesas: totalDespesas, resultado: Math.round((recebido - totalDespesas) * 100) / 100 },
  };
}
