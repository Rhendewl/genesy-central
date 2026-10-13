import { describe, expect, it } from 'vitest';
import { formatMoneyDraft, formatMoneyInput, parseMoneyInput } from '../flowPaymentMoney';

describe('entrada monetária em português', () => {
  it.each([
    ['500000', '500.000', 500000],
    ['480.000,00', '480.000,00', 480000],
    ['R$ 1.500,01', '1.500,01', 1500.01],
    ['1500.01', '1.500,01', 1500.01],
    ['1.500,', '1.500,', 1500],
    [',50', '0,50', .5],
    ['', '', 0],
    ['1.234.567,89', '1.234.567,89', 1234567.89],
  ])('aceita %s sem alterar o valor', (raw, formatted, value) => {
    expect(formatMoneyDraft(raw)).toBe(formatted);
    expect(parseMoneyInput(raw)).toBe(value);
  });
  it('termina com duas casas decimais', () => {
    expect(formatMoneyInput(500000)).toBe('500.000,00');
    expect(formatMoneyInput(125000 / 48)).toBe('2.604,17');
    expect(formatMoneyInput(0)).toBe('0,00');
  });
});
