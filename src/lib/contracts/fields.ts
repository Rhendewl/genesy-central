/** Numeric and derived fields shared by issuance and preview. */
export function numeric(value: string): number {
  return Number(value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value);
}
export function money(value: string): string {
  const n = numeric(value);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value;
}
export function words(n: number): string {
  const units = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','catorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const tens = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const hundreds = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
  if (!Number.isSafeInteger(n) || n < 0 || n > 999999999) return '';
  if (n < 20) return units[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' e '+words(n%10) : '');
  if (n === 100) return 'cem';
  if (n < 1000) return hundreds[Math.floor(n/100)] + (n%100 ? ' e '+words(n%100) : '');
  const scale = n < 1000000 ? 1000 : 1000000;
  const head = Math.floor(n/scale), rest = n%scale;
  return (scale === 1000 ? (head === 1 ? 'mil' : words(head)+' mil') : words(head)+(head === 1 ? ' milhão' : ' milhões')) + (rest ? (rest < 100 || rest%100 === 0 ? ' e ' : ' ')+words(rest) : '');
}
export const isMoney = (key: string) => /(?:valor|mensalidade|preco|multa|entrada|parcela)/.test(key) && !/(pagamento|extenso|percent|porcent)/.test(key);
export function locationDefaults(saved: Record<string,string> = {}) {
  return { cidade: 'João Pessoa', cidade_assinatura: 'João Pessoa', uf: 'PB', uf_assinatura: 'PB', foro_cidade: 'João Pessoa', foro_estado: 'Paraíba', ...saved };
}
const fieldStem = (key: string) => key.replace(/_(?:por_extenso|extenso)$/, '').replace(/_(?:numero|numerico|valor|percentual|porcentagem|meses)$/, '');
function decimalWords(n: number) {
  const [whole, fraction] = String(n).split('.');
  return words(Number(whole)) + (fraction ? ' vírgula '+words(Number(fraction)) : '');
}
export function derivedFields(body: string, input: Record<string,string>, signers: {role:string;name?:string;document?:string;email?:string}[] = []): Record<string,string> {
  const result: Record<string,string> = { ...locationDefaults(), data_assinatura: today(), data_contrato: today(), ...input };
  const keys = Array.from(new Set(Array.from(body.matchAll(/\{\{\s*(\w+)\s*\}\}/g), m=>m[1])));
  const witnesses = signers.filter(s=>s.role === 'testemunha');
  const clients = signers.filter(s=>s.role === 'cliente');
  for(const key of keys){
    const match=key.match(/^(?:cliente|contratante)_(\d+)_(nome|documento|cpf|cnpj|email)$/);
    if(!match)continue;
    const person=clients[Number(match[1])-1];
    const prop=match[2]==='nome'?'name':match[2]==='email'?'email':'document';
    result[key]=typeof person?.[prop]==='string' ? person[prop]!.trim() : '';
  }
  for (const key of keys) {
    const match = key.match(/^testemunha_(\d+)_(nome|cpf|documento|email)$/);
    if (!match) continue;
    const witness = witnesses[Number(match[1])-1];
    const prop = match[2] === 'nome' ? 'name' : match[2] === 'email' ? 'email' : 'document';
    result[key] = typeof witness?.[prop] === 'string' ? witness[prop]!.trim() : '';
  }
  for (const key of keys) {
    if (!key.includes('extenso')) continue;
    const base = key.replace(/_por_extenso|_extenso/g, '');
    if (/^data(?:_|$)/.test(base)) {
      const raw = result[base] || today();
      const parts = raw.split('/');
      const date = parts.length === 3 ? new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00-03:00`) : new Date(`${raw}T12:00:00-03:00`);
      result[key] = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Fortaleza'}).format(date);
      continue;
    }
    const candidates = keys.filter(k => !k.includes('extenso') && fieldStem(k) === fieldStem(key));
    const sourceKey = input[base] !== undefined ? base : candidates.length === 1 ? candidates[0] : base;
    const source = result[sourceKey];
    if (!source?.trim()) { result[key] = ''; continue; }
    const n = numeric(source.replace(/%$/, '').trim());
    if (!Number.isFinite(n) || n < 0) { result[key] = ''; continue; }
    if (isMoney(sourceKey)) {
      const rounded = Math.round(n*100), cents = rounded%100, whole = Math.floor(rounded/100);
      result[key] = words(whole)+(whole === 1 ? ' real' : ' reais')+(cents ? ' e '+words(cents)+(cents === 1 ? ' centavo' : ' centavos') : '');
    } else result[key] = decimalWords(n);
  }
  return result;
}
export function fieldGroup(key: string) {
  if (/testemunha/.test(key)) return 'Testemunhas';
  if (/socio|representante/.test(key)) return 'Sócios e representantes';
  if (/cliente|contratante/.test(key)) return 'Qualificação do cliente';
  if (/contratada/.test(key)) return 'Qualificação da contratada';
  if (/cidade|foro|uf|data|assinatura/.test(key)) return 'Local e assinatura';
  if (/valor|pagamento|mensal|percent|porcent|comissao|multa|parcela/.test(key)) return 'Valores e pagamento';
  if (/mes|prazo|vigencia|duracao/.test(key)) return 'Prazo e vigência';
  return 'Condições do contrato';
}
export function today() { return new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Fortaleza'}).format(new Date()); }

export function qualification(name:string, document:string, address:string) {
  const legal = document.replace(/\D/g,'').length === 14;
  return `${name}, ${legal ? 'pessoa jurídica, inscrita no CNPJ' : 'pessoa física, inscrita no CPF'} sob o nº ${document}${address ? ', com endereço em '+address : ''}`;
}

export function fieldLabel(key:string) {
 const accents:Record<string,string>={vigencia:'Vigência',comissao:'Comissão',duracao:'Duração',endereco:'Endereço',servicos:'Serviços',qualificacao:'Qualificação',razao:'Razão',socio:'Sócio',preco:'Preço',numero:'Número',cpf:'CPF',cnpj:'CNPJ',uf:'UF',email:'E-mail'};
 return key.split('_').filter(Boolean).map((word,i)=>accents[word] || (!i || !['por','de','do','da','e','em'].includes(word) ? word.charAt(0).toUpperCase()+word.slice(1) : word)).join(' ');
}
