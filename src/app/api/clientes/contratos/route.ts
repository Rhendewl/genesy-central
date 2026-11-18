import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { requiredText, renderContract, ROLES, CLIENT_COMPANY_TYPES } from "@/lib/contracts/model";
import { derivedFields, numeric, qualification } from "@/lib/contracts/fields";
import { contentHash, signerToken, signingUrl } from "@/lib/contracts/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const db = await createServerSupabaseClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const results = await Promise.all([
    db
      .from("contract_profiles")
      .select("name,document,address")
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .from("contract_templates")
      .select("id,name,body")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .from("client_contract_documents")
      .select(
        "*,signers:client_contract_signers(id,name,email,role,signed_at,signed_name,signed_document,consent_text,document_hash,ip,user_agent)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (results.some((r) => r.error))
    return NextResponse.json(
      {
        error:
          "Não foi possível carregar os contratos. Confira se a migração de contratos foi aplicada.",
      },
      { status: 500 },
    );
  return NextResponse.json(
    {
      profile: results[0].data,
      templates: results[1].data,
      documents: (results[2].data ?? []).map((d) => ({
        ...d,
        signers: d.signers.map((s: { id: string }) => ({
          ...s,
          url: signingUrl(s.id),
          expected_document: d.client_data?.signer_documents?.[s.id] ?? "",
        })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: NextRequest) {
  const db = await createServerSupabaseClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const b = await req.json();
    if (b.action === "profile") {
      const { error } = await db
        .from("contract_profiles")
        .upsert({
          user_id: user.id,
          name: requiredText(b.name, "Nome"),
          document: requiredText(b.document, "CPF/CNPJ", 30),
          address: typeof b.address === "string" ? b.address.slice(0, 500) : "",
        });
      if (error) throw error;
    } else if (b.action === "template") {
      const template = {name:requiredText(b.name,"Nome do modelo"),body:requiredText(b.body,"Texto do modelo",150000)};
      if (b.id) {
        const {data,error}=await db.from("contract_templates").update(template).eq("id",requiredText(b.id,"Modelo",100)).eq("user_id",user.id).select("id").maybeSingle();
        if(error)throw error;
        if(!data)throw new Error("Modelo não encontrado ou sem permissão para editar");
      } else {
        const {error}=await db.from("contract_templates").insert({user_id:user.id,...template});
        if(error)throw error;
      }
    } else if (b.action === "issue") {
      const { data: template } = await db
        .from("contract_templates")
        .select("body")
        .eq("id", b.template_id)
        .eq("user_id", user.id)
        .single();
      const { data: profile } = await db
        .from("contract_profiles")
        .select("name,document,address")
        .eq("user_id", user.id)
        .single();
      if (!template || !profile?.name || !profile.document)
        throw new Error("Selecione um modelo e salve seus dados primeiro");
      const c = b.client ?? {};
      const companyType=c.company_type ?? "outro";
      if(!CLIENT_COMPANY_TYPES.some(t=>t.value===companyType))throw new Error("Tipo de cliente inválido");
      const client = {
        company_type: companyType,
        name: requiredText(c.name, "Nome do cliente"),
        document: requiredText(c.document, "CPF/CNPJ do cliente", 30),
        address: typeof c.address === "string" ? c.address.slice(0, 500) : "",
        email: typeof c.email === "string" ? c.email.trim().slice(0,200).toLowerCase() : "",
        phone: typeof c.phone === "string" ? c.phone.slice(0, 40) : "",
        contact_name: requiredText(c.contact_name || c.name, "Contato"),
        monthly_fee: numeric(String(c.monthly_fee)) || 0,
      };
      if (
        client.monthly_fee < 0 ||
        !Number.isFinite(client.monthly_fee) ||
        client.monthly_fee > 999999999
      )
        throw new Error("Valor mensal inválido");
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(b.values ?? {}))
        if (typeof value === "string") values[key] = value.slice(0, 5000);
      Object.assign(values, {
        contratada_nome: profile.name,
        contratada_documento: profile.document,
        contratada_endereco: profile.address,
        cliente_nome: client.name,
        cliente_documento: client.document,
        cliente_endereco: client.address,
        cliente_email: client.email,
        cliente_telefone: client.phone,
        cliente_qualificacao: qualification(client.name,client.document,client.address),
        contratada_qualificacao: qualification(profile.name,profile.document,profile.address),
      });
      const body = renderContract(template.body, derivedFields(template.body, values, Array.isArray(b.signers) ? b.signers : []));
      if (
        !Array.isArray(b.signers) ||
        b.signers.length < 1 ||
        b.signers.length > 20
      )
        throw new Error("Inclua entre 1 e 20 assinadores");
      let clientSignerCount=0;
      const signers: {id:string;name:string;email:string;role:unknown;token_hash:string}[] = b.signers.map((s: Record<string, unknown>) => {
        const id = randomUUID();
        const email = typeof s.email === "string" ? s.email.trim().toLowerCase() : "";
        if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
          throw new Error("E-mail de assinador inválido");
        if (!ROLES.includes(s.role as (typeof ROLES)[number]))
          throw new Error("Papel do assinador inválido");
        if(s.role === "cliente") {
          clientSignerCount++;
          if(clientSignerCount>1) requiredText(s.document,`CPF/CNPJ do contratante ${clientSignerCount}`,30);
        }
        return {
          id,
          name: s.role === "testemunha" && (typeof s.name !== "string" || !s.name.trim()) ? "Testemunha" : requiredText(s.name, "Nome do assinador"),
          email,
          role: s.role,
          token_hash: contentHash(signerToken(id)),
        };
      });
      if (b.sign_now && !signers.some(s => s.role === "contratada")) {
        const id = randomUUID();
        if (signers.length >= 20) throw new Error("Reserve uma vaga para a assinatura da contratada (máximo de 20 assinadores)");
        signers.push({ id, name: profile.name, email: user.email!, role: "contratada", token_hash: contentHash(signerToken(id)) });
      }
      const signerDocuments: Record<string, string> = {};
      let primaryClient=true;
      b.signers.forEach((s: Record<string,unknown>, i:number) => {
        const fallback=s.role === "cliente" && primaryClient ? client.document : s.role === "contratada" ? profile.document : "";
        signerDocuments[signers[i].id] = typeof s.document === "string" && s.document.trim() ? s.document.trim().slice(0,30) : fallback;
        if(s.role === "cliente")primaryClient=false;
      });
      signers.filter(s=>s.role === "contratada").forEach(s=>{signerDocuments[s.id] ||= profile.document;});
      if (!signers.some((s: { role: unknown }) => s.role === "cliente"))
        throw new Error("Inclua ao menos um assinador como cliente");
      if (
        new Set(signers.filter(s=>s.email).map(s=>s.email)).size !==
        signers.filter(s=>s.email).length
      )
        throw new Error("Use um e-mail distinto para cada assinador");
      const { error } = await createAdminSupabaseClient().rpc(
        "issue_client_contract",
        {
          p_doc: {
            id: randomUUID(),
            user_id: user.id,
            title: requiredText(b.title, "Título"),
            body,
            content_hash: contentHash(body),
            client_data: { ...client, signer_documents: signerDocuments },
          },
          p_signers: signers,
        },
      );
      if (error) throw error;
      return NextResponse.json({ok:true, signing_url: b.sign_now ? signingUrl(signers.find(s=>s.role === "contratada")!.id) : null});
    } else if (b.action === "delete") {
      const id=requiredText(b.id,"Contrato",100);
      const {data:owned,error:lookupError}=await db.from("client_contract_documents").select("id").eq("id",id).eq("user_id",user.id).maybeSingle();
      if(lookupError)throw lookupError;
      if(!owned)throw new Error("Contrato não encontrado ou sem permissão para excluir");
      const {data:removed,error}=await createAdminSupabaseClient().from("client_contract_documents").delete().eq("id",id).eq("user_id",user.id).select("id");
      if(error)throw error;
      if(!removed?.length)throw new Error("O contrato não foi excluído. Atualize e tente novamente.");
    } else if (b.action === "cancel") {
      const { data: doc } = await db
        .from("client_contract_documents")
        .select("id")
        .eq("id", b.id)
        .eq("user_id", user.id)
        .single();
      if (!doc) throw new Error("Contrato não encontrado");
      const { data, error } = await createAdminSupabaseClient()
        .from("client_contract_documents")
        .update({ status: "cancelled" })
        .eq("id", doc.id)
        .eq("status", "pending")
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Este contrato não está pendente");
    } else throw new Error("Ação inválida");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Não foi possível salvar o contrato",
      },
      { status: 400 },
    );
  }
}
