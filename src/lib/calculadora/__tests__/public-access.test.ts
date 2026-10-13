import { describe, expect, it } from 'vitest';
import { ACCESS_SECONDS, signCalculatorAccess, verifyCalculatorAccess, normalizedContact, registrationFields } from '../public-access';

describe('acesso da calculadora pública', () => {
  it('lembra o navegador, restringe o link e expira sem autenticar na plataforma', () => {
    const token = signCalculatorAccess('link-a', 'test-secret', 1000000);
    expect(verifyCalculatorAccess(token,'link-a','test-secret',1000000)).toBe(true);
    expect(verifyCalculatorAccess(token,'link-b','test-secret',1000000)).toBe(false);
    expect(verifyCalculatorAccess(token,'link-a','other-secret',1000000)).toBe(false);
    expect(verifyCalculatorAccess(token,'link-a','test-secret',1000000+ACCESS_SECONDS*1000)).toBe(false);
    expect(verifyCalculatorAccess(token+'x','link-a','test-secret',1000000)).toBe(false);
    expect(verifyCalculatorAccess(undefined,'link-a','test-secret')).toBe(false);
    expect(verifyCalculatorAccess('forged.token','link-a','test-secret')).toBe(false);
  });
  it('normaliza contatos com ou sem DDI e exige os dados de captura', () => {
    expect(normalizedContact('(85) 99999-1234')).toBe('5585999991234');
    expect(normalizedContact('+55 85 99999-1234')).toBe('5585999991234');
    expect(() => normalizedContact('123')).toThrow();
    const body = { name:' Marina ', email:'MARINA@example.com',phone:'85999991234',profile:'corretor' };
    expect(registrationFields(body)).toEqual({ name:'Marina',email:'marina@example.com',phone:'5585999991234',profile:'corretor',creci:'' });
    expect(() => registrationFields({ ...body, email:'bad' })).toThrow();
    expect(() => registrationFields({ ...body, profile:'admin' })).toThrow();
    expect(() => registrationFields({ ...body, website:'spam' })).toThrow();
  });
});
