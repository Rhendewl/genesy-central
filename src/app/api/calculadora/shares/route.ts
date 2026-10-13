import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { calculatorContext, calculatorError } from '@/lib/calculadora/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { db, ownerId, restrictedPipelineId } = await calculatorContext();
    const [links, pipelines] = await Promise.all([
      (restrictedPipelineId ? db.from('calculator_shares').select('*').eq('pipeline_id', restrictedPipelineId) : db.from('calculator_shares').select('*')).eq('user_id', ownerId).order('created_at', { ascending: false }),
      (restrictedPipelineId ? db.from('crm_pipelines').select('id,name,crm_stages(id,name,is_active)').eq('id', restrictedPipelineId) : db.from('crm_pipelines').select('id,name,crm_stages(id,name,is_active)')).eq('user_id', ownerId).eq('is_active', true),
    ]);
    if (links.error) throw links.error; if (pipelines.error) throw pipelines.error;
    return NextResponse.json({ shares: links.data, pipelines: pipelines.data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return calculatorError(error); }
}
async function save(req: NextRequest, updating: boolean) {
  try {
    const { db, ownerId, restrictedPipelineId } = await calculatorContext();
    const body = await req.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    if (updating) {
      const { data: existing } = await db.from('calculator_shares').select('pipeline_id').eq('id', body.id).eq('user_id', ownerId).maybeSingle();
      if (!existing || (restrictedPipelineId && existing.pipeline_id !== restrictedPipelineId)) return NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 });
    }
    if (restrictedPipelineId && body.pipeline_id && body.pipeline_id !== restrictedPipelineId) return NextResponse.json({ error: 'Pipeline não permitida.' }, { status: 403 });
    if (updating && typeof body.active === 'boolean' && typeof body.id === 'string' && !body.stage_id) {
      const { data, error } = await db.from('calculator_shares').update({ active: body.active }).eq('id', body.id).eq('user_id', ownerId).select().single();
      if (error) throw error; return NextResponse.json({ share: data });
    }
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    if (!title || typeof body.stage_id !== 'string' || typeof body.pipeline_id !== 'string') return NextResponse.json({ error: 'Informe o nome do link, a pipeline e a etapa.' }, { status: 400 });
    const { data: pipeline } = await db.from('crm_pipelines').select('id').eq('id', body.pipeline_id).eq('user_id', ownerId).eq('is_active', true).maybeSingle();
    const { data: stage } = await db.from('crm_stages').select('id').eq('id', body.stage_id).eq('pipeline_id', body.pipeline_id).eq('user_id', ownerId).eq('is_active', true).maybeSingle();
    if (!pipeline || !stage) return NextResponse.json({ error: 'Selecione uma etapa ativa da pipeline do seu CRM.' }, { status: 400 });
    const values = { title, pipeline_id: pipeline.id, stage_id: stage.id };
    const query = updating ? db.from('calculator_shares').update(values).eq('id', body.id).eq('user_id', ownerId) : db.from('calculator_shares').insert({ ...values, user_id: ownerId, slug: randomUUID().replace(/-/g, '') });
    const { data, error } = await query.select().single();
    if (error) throw error; return NextResponse.json({ share: data }, { status: updating ? 200 : 201 });
  } catch (error) { return calculatorError(error); }
}
export async function POST(req: NextRequest) { return save(req, false); }
export async function PATCH(req: NextRequest) { return save(req, true); }
