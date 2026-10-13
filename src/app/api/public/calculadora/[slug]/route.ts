import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { accessCookieName, ACCESS_SECONDS, signCalculatorAccess, verifyCalculatorAccess, normalizedContact, registrationFields } from '@/lib/calculadora/public-access';
import { getPlatformEventBus } from '@/lib/event-bus/platform';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
async function findShare(slug: string) {
  const db = createAdminSupabaseClient();
  const { data: share, error } = await db.from('calculator_shares').select('id,title,active,stage_id,pipeline_id,user_id').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!share?.active) return { db, share: null };
  const [stage, pipeline] = await Promise.all([
    db.from('crm_stages').select('id').eq('id', share.stage_id).eq('pipeline_id', share.pipeline_id).eq('user_id', share.user_id).eq('is_active', true).maybeSingle(),
    db.from('crm_pipelines').select('id').eq('id', share.pipeline_id).eq('user_id', share.user_id).eq('is_active', true).maybeSingle(),
  ]);
  if (stage.error) throw stage.error; if (pipeline.error) throw pipeline.error;
  return { db, share: stage.data && pipeline.data ? share : null };
}
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { share } = await findShare(params.slug);
    if (!share) return NextResponse.json({ error: 'Este link não está disponível.' }, { status: 404, headers });
    const granted = verifyCalculatorAccess(req.cookies.get(accessCookieName(params.slug))?.value, params.slug, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    // Never expose destination, owner, CRM IDs, or registered contact details.
    return NextResponse.json({ title: share.title, granted }, { headers });
  } catch { return NextResponse.json({ error: 'A calculadora está temporariamente indisponível.' }, { status: 503, headers }); }
}
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== req.nextUrl.origin) return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 403, headers });
    const { db, share } = await findShare(params.slug);
    if (!share) return NextResponse.json({ error: 'Este link não está disponível.' }, { status: 404, headers });
    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim();
    const key = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(`${params.slug}:${ip}`).digest('hex');
    const attempt = await db.rpc('calculator_take_attempt', { p_key: key });
    if (attempt.error) throw attempt.error;
    if (!attempt.data) return NextResponse.json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, { status: 429, headers });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || body.website) return NextResponse.json({ error: 'Confira os campos do cadastro.' }, { status: 400, headers });
    if (body.action === 'resume') {
      let phone: string;
      try { phone = normalizedContact(body.phone); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400, headers }); }
      const result = await db.from('calculator_captures').select('id').eq('share_id', share.id).eq('phone', phone).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return NextResponse.json({ error: 'Não encontramos um cadastro com esse contato neste link. Faça seu cadastro para continuar.' }, { status: 404, headers });
    } else if (body.action === 'register') {
      let fields: ReturnType<typeof registrationFields>;
      try { fields = registrationFields(body); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400, headers }); }
      const { data, error } = await db.rpc('calculator_register', { p_slug: params.slug, p_name: fields.name, p_email: fields.email, p_phone: fields.phone, p_profile: fields.profile, p_creci: fields.creci });
      if (error) throw error;
      if (data.created) {
        try { await getPlatformEventBus().publish('lead.stage.entered', { leadId: data.lead_id, pipelineId: data.pipeline_id, stageId: data.stage_id, fromStageId: null, userId: data.user_id }); }
        catch (error) { console.error('[calculator] CRM event failed after registration', error); }
      }
    } else return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400, headers });
    const response = NextResponse.json({ granted: true }, { headers });
    response.cookies.set(accessCookieName(params.slug), signCalculatorAccess(params.slug, process.env.SUPABASE_SERVICE_ROLE_KEY!), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: ACCESS_SECONDS });
    return response;
  } catch { return NextResponse.json({ error: 'Não foi possível liberar o acesso. Tente novamente.' }, { status: 503, headers }); }
}
