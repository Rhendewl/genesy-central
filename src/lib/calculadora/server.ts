import { isAdministrativeMember } from '@/lib/user-access';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

export async function calculatorContext() {
  const sessionDb = await createServerSupabaseClient();
  const { data: { user } } = await sessionDb.auth.getUser();
  if (!user) throw Object.assign(new Error('Não autenticado'), { status: 401 });
  const { data: profiles, error } = await sessionDb.from('user_profiles').select('owner_id,role,job_title,crm_pipeline_id,is_active,permissions').eq('auth_user_id', user.id);
  if (error) throw error;
  const active = (profiles ?? []).filter(p => p.is_active);
  const profile = active.find(p => p.owner_id !== user.id) ?? active[0];
  const ownerId = profile?.owner_id ?? user.id;
  const admin = profile && (ownerId === user.id || profile.role === 'admin');
  if (!profile || (!admin && (!profile.permissions?.includes('calculadora') || !profile.permissions?.includes('crm')))) throw Object.assign(new Error('É necessário acesso à Calculadora e ao CRM.'), { status: 403 });
  const fullCrm = isAdministrativeMember(profile, ownerId === user.id);
  const restrictedPipelineId = fullCrm ? null : profile.crm_pipeline_id;
  if (!fullCrm && !restrictedPipelineId) throw Object.assign(new Error('Seu perfil precisa de uma pipeline atribuída para gerenciar capturas.'), { status: 403 });
  return { db: createAdminSupabaseClient(), ownerId, restrictedPipelineId };
}
export function calculatorError(error: unknown) {
  const item = error as { status?: number; code?: string; message?: string };
  const migration = ['42P01','PGRST205','PGRST202'].includes(item?.code ?? '');
  return NextResponse.json({ error: migration ? 'A captura de leads aguarda a atualização do banco de dados da calculadora.' : item?.status && item.status < 500 ? item.message : 'Não foi possível concluir a operação. Tente novamente.', migrationRequired: migration }, { status: migration ? 503 : item?.status ?? 500 });
}
