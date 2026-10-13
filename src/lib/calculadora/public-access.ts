import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ACCESS_SECONDS = 365 * 24 * 60 * 60;
export function accessCookieName(slug: string) { return `calculator_${slug.slice(0, 32)}`; }
export function signCalculatorAccess(slug: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ slug, exp: Math.floor(now / 1000) + ACCESS_SECONDS, nonce: randomBytes(12).toString('hex') })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function verifyCalculatorAccess(token: string | undefined, slug: string, secret: string, now = Date.now()): boolean {
  if (!token || token.length > 1000) return false;
  try {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return false;
    const expected = createHmac('sha256', secret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return parsed.slug === slug && typeof parsed.exp === 'number' && parsed.exp > Math.floor(now / 1000);
  } catch { return false; }
}
export function normalizedContact(value: unknown): string {
  let phone = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  if (!/^55\d{10,11}$/.test(phone)) throw new Error('Informe um contato válido com DDD.');
  return phone;
}
export function registrationFields(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
  const profile = typeof body.profile === 'string' ? body.profile : '';
  const creci = typeof body.creci === 'string' ? body.creci.trim().slice(0, 80) : '';
  if (!name || !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email) || !['corretor','imobiliaria','construtora'].includes(profile) || body.website) throw new Error('Preencha nome, e-mail, contato e perfil corretamente.');
  return { name, email, phone: normalizedContact(body.phone), profile, creci };
}
