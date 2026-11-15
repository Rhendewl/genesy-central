/** Relayout an existing terminal signature list without changing the stored text/hash.
 * Only a final standalone party heading followed by other signature headings qualifies.
 */
export function contractMainText(body:string) {
 const headings=Array.from(body.matchAll(/^(?:CONTRATANTE|CONTRATAD[AO])\s*$/gim));
 for(const match of headings) {
  const tail=body.slice(match.index);
  if(!/^TESTEMUNHA\s*(?:0?\d+)?\s*$/im.test(tail) || !/^CONTRATAD[AO]\s*$/im.test(tail)) continue;
  if(/cl[áa]usula|obrigaç|disposiç|^\s*\d+[.)]\s/m.test(tail)) continue;
  // A signature list is short. Preserve long/ambiguous contractual sections verbatim.
  if(tail.length>1800) continue;
  return body.slice(0,match.index).trimEnd();
 }
 return body;
}
