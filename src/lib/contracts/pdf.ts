import { contractMainText } from './presentation';
import type { ContractSigner } from './model';
import { signatureFonts, signatureStyle, signerRoles } from './signature-styles';
export { signatureFonts, signatureStyle } from './signature-styles';
export async function downloadContract(doc: {id?:string;title:string;body:string;content_hash:string;signers:Partial<ContractSigner>[]}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  // Rasterize the existing brand asset for consistent SVG support in PDF readers.
  const logo = new Image(); logo.src = '/genesy-logoname.svg'; await logo.decode();
  const canvas = document.createElement('canvas'); canvas.width=700; canvas.height=160;
  canvas.getContext('2d')!.drawImage(logo,0,0,700,152);
  const brand=canvas.toDataURL('image/png');
  const icon = new Image();icon.src='/g-cinza.svg';await icon.decode();
  const iconCanvas=document.createElement('canvas');iconCanvas.width=100;iconCanvas.height=100;iconCanvas.getContext('2d')!.drawImage(icon,0,0,100,100);
  const mark=iconCanvas.toDataURL('image/png');
  let y=42;
  function header() { pdf.setFillColor(25,29,34);pdf.rect(0,0,210,32,'F');pdf.addImage(brand,'PNG',18,10,48,11);pdf.setTextColor(238,240,242);pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.text('DOCUMENTO CONTRATUAL',192,14,{align:'right'});pdf.setFontSize(6);pdf.text(doc.id || '',192,21,{align:'right'});pdf.setDrawColor(162,169,175);pdf.line(0,32,210,32);pdf.setTextColor(36,36,36); }
  function page() { pdf.addPage(); header(); y=42; }
  function add(text:string,size=11) {
    pdf.setFont('helvetica','normal'); pdf.setFontSize(size);
    for(const line of pdf.splitTextToSize(text,174)) { if(y>272) page(); pdf.text(line,18,y); y+=size*.53; } y+=4;
  }
  header(); add(doc.title,16); add(doc.signers.length ? contractMainText(doc.body) : doc.body);
  y+=8;
  if(y>215) page();
  add('Assinaturas eletrônicas',14);
  for(const signer of doc.signers) {
    if(y>220) page();
    let top=y;
    pdf.setFont('helvetica','bold');pdf.setFontSize(10);
    const person=String(signer.signed_name || signer.name || 'Assinador');
    const lines=pdf.splitTextToSize(person,77);
    const blockHeight=Math.max(48,28+lines.length*4);
    if(y+blockHeight>275){page();top=y;pdf.setFont('helvetica','bold');pdf.setFontSize(10);}
    pdf.text(lines,18,top+10);
    pdf.setFont('helvetica','normal');pdf.setFontSize(8);
    pdf.text(signerRoles[signer.role || ''] || '',18,top+12+lines.length*4);
    const identity=signer.signed_document || signer.expected_document;
    if(identity)pdf.text(`CPF/CNPJ: ${identity}`,18,top+18+lines.length*4);
    if(signer.signed_at) {
      pdf.setFillColor(240,242,243);pdf.setDrawColor(88,98,105);pdf.setLineDashPattern([1,1],0);pdf.roundedRect(101,top,91,44,3,3,'FD');pdf.setLineDashPattern([],0);
      const font=signatureFonts[signatureStyle(signer.consent_text)];
      const face=new FontFace(font,`url(/fonts/signatures/${font}.ttf)`); await face.load(); document.fonts.add(face);
      const c=document.createElement('canvas'); c.width=1400;c.height=260;
      const ctx=c.getContext('2d')!; ctx.font=`160px ${font}`;ctx.fillStyle='#163631';
      const width=ctx.measureText(person).width; if(width>1350) ctx.font=`${Math.floor(160*1350/width)}px ${font}`;
      ctx.fillText(person,12,190);
      pdf.addImage(c.toDataURL('image/png'),'PNG',106,top+1,81,13);
      pdf.setFont('helvetica','normal');pdf.setFontSize(6);
      pdf.addImage(mark,'PNG',104,top+18,8,8);
      pdf.text('Assinado eletronicamente',116,top+17);
      pdf.text(`ID do documento: ${doc.id || ''}`,116,top+22);
      pdf.text(`Código da assinatura: ${signer.id || ''}`,116,top+27);
      pdf.text(new Date(signer.signed_at).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}),106,top+33);
      if(signer.ip) pdf.text(`IP: ${signer.ip}`,116,top+38);
    } else {pdf.setFontSize(8);pdf.text('Aguardando assinatura',110,top+22);}
    pdf.setDrawColor(48,55,58);pdf.line(18,top+blockHeight,192,top+blockHeight);
    y=top+blockHeight+10;
  }
  if(y>230)page();
  add(`Identificação do conteúdo · SHA-256: ${doc.content_hash}`,8);
  for(const s of doc.signers.filter(s=>s.signed_at))add(`${s.signed_name || s.name}: ${s.consent_text || ''}`,8);
  const count=pdf.getNumberOfPages(); for(let n=1;n<=count;n++) {pdf.setPage(n);pdf.setFont('helvetica');pdf.setFontSize(8);pdf.text(`Genesy · ${n} / ${count}`,18,289);}
  pdf.save(`${doc.title.replace(/[^a-zA-Z0-9À-ÿ_ -]/g,'')}.pdf`);
}
