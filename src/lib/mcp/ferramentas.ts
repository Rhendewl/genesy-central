import { randomUUID } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { parseAprendizadoPayload, parseEventoPayload, parseItemPayload } from "@/lib/esteira/payload";
import { registrarAprendizado, registrarEvento, registrarItem } from "@/lib/esteira/service";
import { ErroFerramenta, type McpFerramenta } from "./protocol";
import { conferirDestino, urlPublicaSegura } from "./seguranca";

// ─────────────────────────────────────────────────────────────────────────────
// Ferramentas do conector MCP da Genesy. Tudo roda com o service role, sempre
// filtrado pela conta do dono da agência (ctx.ownerId).
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = "criativos";
const MAX_BYTES = 25 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/quicktime": "mov",
};
const FORMATOS = ["feed", "stories", "reels", "carrossel", "outro"] as const;
const STATUS_CRIATIVO = ["rascunho", "aprovado", "em_campanha", "arquivado"] as const;
const ORIGENS = ["alfred", "bruce", "claude", "equipe"] as const;
const STATUS_TAREFA = ["a_fazer", "em_andamento", "aguardando", "concluido"] as const;
const PRIORIDADES = ["baixa", "media", "alta", "urgente"] as const;

// ── validação de argumentos ─────────────────────────────────────────────────
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
function uuid(args: Record<string, unknown>, campo: string, obrigatorio = false): string | undefined {
  const v = texto(args, campo, 36, obrigatorio);
  if (v && !UUID.test(v)) throw new ErroFerramenta(`"${campo}" não é um id válido. Use listar_clientes para achar o id.`);
  return v;
}
function limite(args: Record<string, unknown>, padrao: number, maximo: number): number {
  const v = args.limite;
  if (v === undefined || v === null) return padrao;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) throw new ErroFerramenta('"limite" precisa ser um número inteiro positivo.');
  return Math.min(v, maximo);
}

async function baixarArquivo(url: URL): Promise<{ bytes: Uint8Array; mime: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    let atual = url;
    let res: Response | null = null;
    for (let salto = 0; salto <= 4; salto++) {
      await conferirDestino(atual);
      res = await fetch(atual, { signal: ctrl.signal, redirect: "manual" });
      const destino = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && destino) {
        atual = urlPublicaSegura(new URL(destino, atual).toString());
        res = null;
        continue;
      }
      break;
    }
    if (!res) throw new ErroFerramenta("O link redirecionou vezes demais.");
    if (!res.ok) throw new ErroFerramenta(`Não consegui baixar o arquivo (HTTP ${res.status}). O link pode ter expirado: exporte de novo e tente.`);
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!MIME_EXT[mime]) throw new ErroFerramenta(`Tipo de arquivo não aceito (${mime || "desconhecido"}). Use PNG, JPG, WEBP, GIF, MP4 ou MOV.`);
    const tamanho = Number(res.headers.get("content-length") ?? "0");
    if (tamanho > MAX_BYTES) throw new ErroFerramenta("Arquivo maior que 25 MB.");
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new ErroFerramenta("Arquivo maior que 25 MB.");
    if (bytes.byteLength === 0) throw new ErroFerramenta("O arquivo veio vazio.");
    return { bytes, mime };
  } catch (e) {
    if (e instanceof ErroFerramenta) throw e;
    throw new ErroFerramenta("Não consegui baixar o arquivo (o link demorou ou recusou a conexão).");
  } finally {
    clearTimeout(timer);
  }
}

async function buscarCliente(ownerId: string, clienteId: string) {
  const { data, error } = await createAdminSupabaseClient().from("agency_clients")
    .select("id,name,company_type,status").eq("user_id", ownerId).eq("id", clienteId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ErroFerramenta("Cliente não encontrado. Use listar_clientes para ver os ids.");
  return data as { id: string; name: string; company_type: string; status: string };
}

const CAMPOS_CRIATIVO = "id,cliente_id,cliente_nome,titulo,formato,status,url,mime,tamanho_bytes,origem,meta_campanha_id,notas,created_at,updated_at";

// ── ferramentas ─────────────────────────────────────────────────────────────
export const FERRAMENTAS_GENESY: McpFerramenta[] = [
  {
    name: "listar_clientes",
    title: "Listar clientes",
    description: "Lista os clientes da agência (id, nome, tipo, status). Use o id nas outras ferramentas.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Parte do nome do cliente (opcional)." },
        status: { type: "string", enum: ["ativo", "inativo", "churned", "todos"], description: "Padrão: ativo." },
      },
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const busca = texto(args, "busca", 80);
      const status = opcao(args, "status", ["ativo", "inativo", "churned", "todos"] as const, "ativo");
      let q = createAdminSupabaseClient().from("agency_clients").select("id,name,company_type,status")
        .eq("user_id", ctx.ownerId).order("name").limit(200);
      if (status !== "todos") q = q.eq("status", status as string);
      if (busca) q = q.ilike("name", `%${busca.replace(/[%_]/g, "")}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { clientes: ((data ?? []) as { id: string; name: string; company_type: string; status: string }[]).map((c) => ({ id: c.id, nome: c.name, tipo: c.company_type, status: c.status })) };
    },
  },
  {
    name: "ver_cliente",
    title: "Ver cliente",
    description: "Detalhes de um cliente: contato, metas de tráfego, contas de anúncio e os últimos criativos da biblioteca.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: { cliente_id: { type: "string", description: "id do cliente (de listar_clientes)." } },
      required: ["cliente_id"],
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const id = uuid(args, "cliente_id", true) as string;
      const db = createAdminSupabaseClient();
      const [cliente, trafego, contas, criativos] = await Promise.all([
        db.from("agency_clients").select("id,name,company_type,status,contact_name,contact_email,contact_phone,notes,contract_start,contract_end")
          .eq("user_id", ctx.ownerId).eq("id", id).maybeSingle(),
        db.from("traffic_client_settings").select("monthly_budget,status,platforms,max_cpl,target_leads,target_conversions,min_ctr,target_roas,notes")
          .eq("user_id", ctx.ownerId).eq("client_id", id).maybeSingle(),
        db.from("ad_platform_accounts").select("platform,account_name,account_id,status").eq("user_id", ctx.ownerId).eq("client_id", id),
        db.from("criativos_biblioteca").select(CAMPOS_CRIATIVO).eq("user_id", ctx.ownerId).eq("cliente_id", id)
          .order("created_at", { ascending: false }).limit(10),
      ]);
      if (cliente.error) throw new Error(cliente.error.message);
      if (!cliente.data) throw new ErroFerramenta("Cliente não encontrado. Use listar_clientes para ver os ids.");
      return {
        cliente: cliente.data,
        trafego: trafego.data ?? null,
        contas_de_anuncio: contas.data ?? [],
        ultimos_criativos: criativos.error ? [] : criativos.data ?? [],
      };
    },
  },
  {
    name: "salvar_criativo",
    title: "Salvar criativo na biblioteca",
    description: "Baixa uma imagem ou vídeo de um link https (por exemplo, a exportação do Canva) e salva na biblioteca do cliente (sem cliente_id = conteúdo da própria Genesy). Devolve uma URL pública permanente, que serve para Meta Ads e Instagram. Use quando um criativo for aprovado.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string", description: "id do cliente (de listar_clientes). Deixe vazio para posts da própria Genesy." },
        titulo: { type: "string", description: "Ex.: \"Live Park · lançamento · feed v2\"." },
        arquivo_url: { type: "string", description: "Link https do arquivo (PNG, JPG, WEBP, GIF, MP4 ou MOV, até 25 MB)." },
        formato: { type: "string", enum: [...FORMATOS], description: "Padrão: feed." },
        status: { type: "string", enum: ["rascunho", "aprovado"], description: "Padrão: aprovado." },
        origem: { type: "string", enum: [...ORIGENS], description: "Quem está salvando. Padrão: claude." },
        notas: { type: "string", description: "Opcional: oferta, público, observações." },
      },
      required: ["titulo", "arquivo_url"],
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const clienteId = uuid(args, "cliente_id");
      const titulo = texto(args, "titulo", 200, true) as string;
      const url = urlPublicaSegura(texto(args, "arquivo_url", 4000, true) as string);
      const formato = opcao(args, "formato", FORMATOS, "feed");
      const status = opcao(args, "status", ["rascunho", "aprovado"] as const, "aprovado");
      const origem = opcao(args, "origem", ORIGENS, "claude");
      const notas = texto(args, "notas", 1000);
      const clienteNome = clienteId ? (await buscarCliente(ctx.ownerId, clienteId)).name : "Genesy (própria)";
      const { bytes, mime } = await baixarArquivo(url);

      const db = createAdminSupabaseClient();
      const mes = new Date().toISOString().slice(0, 7);
      const caminho = `biblioteca/${ctx.ownerId}/${clienteId ?? "genesy"}/${mes}/${randomUUID()}.${MIME_EXT[mime]}`;
      const { error: upErro } = await db.storage.from(BUCKET).upload(caminho, bytes, { contentType: mime, upsert: false });
      if (upErro) throw new Error(upErro.message);
      const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(caminho);

      const { data, error } = await db.from("criativos_biblioteca").insert({
        user_id: ctx.ownerId, cliente_id: clienteId ?? null, cliente_nome: clienteNome, titulo, formato, status,
        storage_path: caminho, url: publicUrl, mime, tamanho_bytes: bytes.byteLength, origem, notas: notas ?? null,
      }).select(CAMPOS_CRIATIVO).single();
      if (error) {
        await db.storage.from(BUCKET).remove([caminho]);
        throw new Error(error.message);
      }
      return { criativo: data };
    },
  },
  {
    name: "listar_criativos",
    title: "Listar criativos",
    description: "Lista criativos da biblioteca, do mais novo para o mais antigo, com a URL pública de cada um.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string", description: "Opcional: só deste cliente." },
        status: { type: "string", enum: [...STATUS_CRIATIVO], description: "Opcional." },
        limite: { type: "integer", minimum: 1, maximum: 50, description: "Padrão: 20." },
      },
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const clienteId = uuid(args, "cliente_id");
      const status = opcao(args, "status", STATUS_CRIATIVO);
      let q = createAdminSupabaseClient().from("criativos_biblioteca").select(CAMPOS_CRIATIVO)
        .eq("user_id", ctx.ownerId).order("created_at", { ascending: false }).limit(limite(args, 20, 50));
      if (clienteId) q = q.eq("cliente_id", clienteId);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { criativos: data ?? [] };
    },
  },
  {
    name: "atualizar_criativo",
    title: "Atualizar criativo",
    description: "Muda o status de um criativo (ex.: em_campanha depois de subir na Meta), o título, as notas ou o id da campanha.",
    inputSchema: {
      type: "object",
      properties: {
        criativo_id: { type: "string" },
        status: { type: "string", enum: [...STATUS_CRIATIVO] },
        titulo: { type: "string" },
        meta_campanha_id: { type: "string", description: "id da campanha na Meta, quando estiver em campanha." },
        notas: { type: "string" },
      },
      required: ["criativo_id"],
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const id = uuid(args, "criativo_id", true) as string;
      const mudancas: Record<string, unknown> = {};
      const status = opcao(args, "status", STATUS_CRIATIVO); if (status) mudancas.status = status;
      const titulo = texto(args, "titulo", 200); if (titulo) mudancas.titulo = titulo;
      const campanha = texto(args, "meta_campanha_id", 60); if (campanha) mudancas.meta_campanha_id = campanha;
      const notas = texto(args, "notas", 1000); if (notas) mudancas.notas = notas;
      if (!Object.keys(mudancas).length) throw new ErroFerramenta("Nada para atualizar: informe status, titulo, meta_campanha_id ou notas.");
      mudancas.updated_at = new Date().toISOString();
      const { data, error } = await createAdminSupabaseClient().from("criativos_biblioteca").update(mudancas)
        .eq("user_id", ctx.ownerId).eq("id", id).select(CAMPOS_CRIATIVO).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new ErroFerramenta("Criativo não encontrado.");
      return { criativo: data };
    },
  },
  {
    name: "criar_tarefa",
    title: "Criar tarefa no Workspace",
    description: "Cria uma tarefa no Workspace do dono da agência (quadro padrão, coluna A fazer). Ex.: \"Subir campanha Luna com os 2 criativos aprovados\".",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        descricao: { type: "string" },
        prioridade: { type: "string", enum: [...PRIORIDADES], description: "Padrão: media." },
        prazo: { type: "string", description: "Data no formato AAAA-MM-DD (opcional)." },
        cliente_id: { type: "string", description: "Opcional: o nome do cliente vai na descrição." },
      },
      required: ["titulo"],
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const titulo = texto(args, "titulo", 200, true) as string;
      const prioridade = opcao(args, "prioridade", PRIORIDADES, "media");
      const prazo = texto(args, "prazo", 10);
      if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) throw new ErroFerramenta('"prazo" precisa estar no formato AAAA-MM-DD.');
      const clienteId = uuid(args, "cliente_id");
      let descricao = texto(args, "descricao", 4000) ?? "";
      if (clienteId) descricao = `Cliente: ${(await buscarCliente(ctx.ownerId, clienteId)).name}${descricao ? `\n\n${descricao}` : ""}`;
      descricao = `${descricao ? `${descricao}\n\n` : ""}Criada pela IA (conector Genesy).`;

      const db = createAdminSupabaseClient();
      const { data: ultima } = await db.from("workspace_tasks").select("position")
        .eq("user_id", ctx.ownerId).eq("status", "a_fazer").order("position", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await db.from("workspace_tasks").insert({
        user_id: ctx.ownerId, created_by: ctx.ownerId, title: titulo, description: descricao,
        status: "a_fazer", priority: prioridade, due_date: prazo ?? null, tags: [],
        position: ((ultima?.position as number | undefined) ?? -10) + 10,
      }).select("id,title,status,priority,due_date").single();
      if (error) throw new Error(error.message);
      const { data: perfil } = await db.from("user_profiles").select("id")
        .eq("auth_user_id", ctx.ownerId).eq("owner_id", ctx.ownerId).eq("is_active", true).limit(1).maybeSingle();
      if (perfil) await db.from("workspace_task_assignees").insert({ task_id: data.id, assignee_id: perfil.id });
      return { tarefa: data };
    },
  },
  {
    name: "listar_tarefas",
    title: "Listar tarefas do Workspace",
    description: "Lista as tarefas do Workspace do dono da agência.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...STATUS_TAREFA], description: "Padrão: todas menos concluídas." },
        limite: { type: "integer", minimum: 1, maximum: 100, description: "Padrão: 30." },
      },
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const status = opcao(args, "status", STATUS_TAREFA);
      let q = createAdminSupabaseClient().from("workspace_tasks").select("id,title,status,priority,due_date,updated_at")
        .eq("user_id", ctx.ownerId).order("updated_at", { ascending: false }).limit(limite(args, 30, 100));
      q = status ? q.eq("status", status) : q.neq("status", "concluido");
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { tarefas: data ?? [] };
    },
  },
  {
    name: "esteira_registrar",
    title: "Registrar na Esteira das IAs",
    description: "Mostra o andamento de um trabalho na Esteira da plataforma. tipo=item cria/atualiza um trabalho (agente, ref, titulo, cliente, etapa pedido|produzindo|esperando|aprovado|no_ar|concluido|cancelado, passo, progresso, detalhe, links); tipo=evento põe uma linha no feed (agente, texto); tipo=aprendizado registra uma regra salva ou proposta (agente, tipo_aprendizado regra|proposta, escopo, texto, ref).",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["item", "evento", "aprendizado"] },
        agente: { type: "string", enum: ["alfred", "bruce"] },
        ref: { type: "string" },
        titulo: { type: "string" },
        cliente: { type: "string" },
        etapa: { type: "string", enum: ["pedido", "produzindo", "esperando", "aprovado", "no_ar", "concluido", "cancelado"] },
        passo: { type: "string" },
        progresso: { type: "integer", minimum: 0, maximum: 100 },
        detalhe: { type: "string" },
        links: { type: "array", items: { type: "object", properties: { label: { type: "string" }, url: { type: "string" } }, required: ["url"] } },
        texto: { type: "string" },
        tipo_aprendizado: { type: "string", enum: ["regra", "proposta"] },
        escopo: { type: "string" },
      },
      required: ["tipo", "agente"],
      additionalProperties: false,
    },
    async handler(args, ctx) {
      const db = createAdminSupabaseClient();
      const tipo = opcao(args, "tipo", ["item", "evento", "aprendizado"] as const);
      const resultado = tipo === "item"
        ? await (async () => { const p = parseItemPayload(args); if (!p.ok) throw new ErroFerramenta(p.error); return registrarItem(db, ctx.ownerId, p.value); })()
        : tipo === "evento"
          ? await (async () => { const p = parseEventoPayload(args); if (!p.ok) throw new ErroFerramenta(p.error); return registrarEvento(db, ctx.ownerId, p.value); })()
          : await (async () => { const p = parseAprendizadoPayload({ ...args, tipo: args.tipo_aprendizado }); if (!p.ok) throw new ErroFerramenta(p.error); return registrarAprendizado(db, ctx.ownerId, p.value); })();
      if (!resultado.ok) throw new ErroFerramenta(resultado.error);
      return resultado.body;
    },
  },
];
