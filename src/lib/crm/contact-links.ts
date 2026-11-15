/** CRM contacts may also contain email addresses. Only expose actions for phone numbers. */
export function leadContactLinks(contact: string | null | undefined) {
  const value = contact?.trim() ?? "";
  if (!value || !/^\+?[\d\s().-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, "");
  const international = value.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (international) {
    if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  } else if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  } else if (digits.length < 12 || digits.length > 15 || digits.startsWith("0")) {
    return null;
  }
  return { whatsapp: `https://wa.me/${digits}`, telephone: `tel:+${digits}` };
}
