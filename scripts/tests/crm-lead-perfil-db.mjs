// Run with: node scripts/tests/crm-lead-perfil-db.mjs (needs @electric-sql/pglite)
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1), pipe = id(2), tag = id(3);
await db.exec(`
CREATE TABLE public.crm_pipeline_tags(pipeline_id uuid, id uuid, name text, created_at timestamptz DEFAULT now());
INSERT INTO public.crm_pipeline_tags VALUES ('${pipe}','${tag}','CORRETOR(A)',now());
CREATE TABLE public.leads(
  id uuid PRIMARY KEY, user_id uuid, pipeline_id uuid, tags text[] DEFAULT '{}',
  integration_notes text, meta_form_answers jsonb, copied_from_lead_id uuid,
  updated_at timestamptz DEFAULT '2026-01-01');
CREATE FUNCTION public.touch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.touch();
INSERT INTO public.leads(id,user_id,pipeline_id,integration_notes,meta_form_answers,tags) VALUES
 ('${id(10)}','${owner}','${pipe}',E'Origem: Guia\\nPerfil: Corretor\\nE-mail: x@y.com',NULL,'{}'),
 ('${id(11)}','${owner}','${pipe}',E'Formulário Genesy\\nVocê é:: Construtora',NULL,'{}'),
 ('${id(12)}','${owner}','${pipe}',E'E-mail: renatocorretor@gmail.com\\nFormulário: Consultoria imobiliária',NULL,'{}'),
 ('${id(13)}','${owner}','${pipe}',NULL,NULL,ARRAY['${tag}']),
 ('${id(14)}','${owner}','${pipe}',E'Perfil:',NULL,'{}');
`);
await db.exec(readFileSync("supabase/migrations/20261128120000_crm_lead_perfil.sql", "utf8"));
const perfil = async (n) => (await db.query(`SELECT perfil, perfil_manual, updated_at FROM public.leads WHERE id='${id(n)}'`)).rows[0];

// Backfill
assert.equal((await perfil(10)).perfil, "corretor");
assert.equal((await perfil(11)).perfil, "construtora");
assert.equal((await perfil(12)).perfil, null, "e-mail/nome de formulário não definem perfil");
assert.equal((await perfil(13)).perfil, "corretor", "tag CORRETOR(A)");
assert.equal((await perfil(14)).perfil, null);
assert.equal(new Date((await perfil(10)).updated_at).toISOString(), "2026-01-01T00:00:00.000Z", "backfill preserva updated_at");

// Novos leads: Meta com pergunta de perfil, Meta de imóvel sem a pergunta, landing de imobiliária
await db.exec(`INSERT INTO public.leads(id,user_id,pipeline_id,meta_form_answers) VALUES
 ('${id(20)}','${owner}','${pipe}','[{"name":"full_name","values":["Ana"]},{"name":"você_é_corretor,_imobiliária_ou_construtora?","values":["Incorporadora"]}]'),
 ('${id(21)}','${owner}','${pipe}','[{"name":"qual_bairro_você_prefere?","values":["Perto da imobiliária"]},{"name":"você_já_tem_corretor?","values":["Não"]}]'),
 ('${id(22)}','${owner}','${pipe}',NULL);
UPDATE public.leads SET integration_notes=E'Origem: Scripts\\nPerfil: Imobiliária' WHERE id='${id(22)}';`);
assert.equal((await perfil(20)).perfil, "construtora");
assert.equal((await perfil(21)).perfil, null, "formulário de imóvel não ganha perfil");
assert.equal((await perfil(22)).perfil, "imobiliaria", "atualização das respostas classifica");

// Escolha manual não é sobrescrita; limpar manualmente também é respeitado
await db.exec(`UPDATE public.leads SET perfil='imobiliaria', perfil_manual=true WHERE id='${id(10)}';
UPDATE public.leads SET integration_notes=E'Perfil: Corretor' WHERE id='${id(10)}';
UPDATE public.leads SET perfil=NULL, perfil_manual=true WHERE id='${id(11)}';
UPDATE public.leads SET integration_notes=E'Você é: Construtora\\nobs' WHERE id='${id(11)}';`);
assert.equal((await perfil(10)).perfil, "imobiliaria");
assert.equal((await perfil(11)).perfil, null);

// Cópia entre pipelines herda o perfil (inclusive manual)
await db.exec(`INSERT INTO public.leads(id,user_id,pipeline_id,copied_from_lead_id) VALUES ('${id(30)}','${owner}','${pipe}','${id(10)}');`);
assert.deepEqual(
  { perfil: (await perfil(30)).perfil, manual: (await perfil(30)).perfil_manual },
  { perfil: "imobiliaria", manual: true });

await assert.rejects(db.exec(`UPDATE public.leads SET perfil='investidor', perfil_manual=true WHERE id='${id(12)}'`), /leads_perfil_check/);
console.log("OK: backfill (notas, tag, updated_at), Meta com/sem pergunta, atualização, manual, cópia, constraint.");
await db.close();
