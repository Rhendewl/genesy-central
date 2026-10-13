const moneyNumber = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integerNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function formatMoneyInput(value: number): string {
  return moneyNumber.format(Number.isFinite(value) ? value : 0);
}

/** Accept Brazilian values, including pasted currency symbols and decimal amounts. */
export function formatMoneyDraft(raw: string, allowDecimalPoint = true): string {
  let clean = raw.replace(/[^\d.,]/g, '');
  if (!clean) return '';
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '');
  } else if (allowDecimalPoint && clean.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    // Also accept a decimal-point amount pasted from another application.
    const lastDot = clean.lastIndexOf('.');
    clean = clean.slice(0, lastDot).replace(/\./g, '') + ',' + clean.slice(lastDot + 1);
  } else {
    clean = clean.replace(/\./g, '');
  }
  const [whole, ...fractionParts] = clean.split(',');
  const amount = Number(whole || '0');
  if (!Number.isFinite(amount)) return '';
  const grouped = integerNumber.format(amount);
  return grouped + (fractionParts.length ? ',' + fractionParts.join('').slice(0, 2) : '');
}

export function parseMoneyInput(text: string): number {
  const normalized = formatMoneyDraft(text).replace(/\./g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}
