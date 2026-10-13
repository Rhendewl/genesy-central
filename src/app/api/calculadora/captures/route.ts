import { NextRequest, NextResponse } from 'next/server';
import { calculatorContext, calculatorError } from '@/lib/calculadora/server';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const { db, ownerId, restrictedPipelineId } = await calculatorContext();
    const page = Math.max(0, Math.min(100000, Math.trunc(Number(req.nextUrl.searchParams.get('page')) || 0)));
    let query = db.from('calculator_captures').select('id,name,email,phone,profile,creci,created_at,lead_id,pipeline_id,share:calculator_shares(id,title)', { count: 'exact' }).eq('user_id', ownerId).order('created_at', { ascending: false });
    if (restrictedPipelineId) query = query.eq('pipeline_id', restrictedPipelineId);
    const share = req.nextUrl.searchParams.get('share'); if (share) query = query.eq('share_id', share);
    const search = req.nextUrl.searchParams.get('search')?.replace(new RegExp('[^\\p{L}\\p{N} @.+-]', 'gu'), '').slice(0, 80);
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error, count } = await query.range(page * 50, page * 50 + 49);
    if (error) throw error;
    return NextResponse.json({ captures: data, count }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return calculatorError(error); }
}
