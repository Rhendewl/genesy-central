// IDs are persisted in consent evidence. Never reorder or replace an existing font.
export const signatureFonts = ['Allura','GreatVibes','Italianno','Caveat','PermanentMarker','ShadowsIntoLight'] as const;
export const signatureChoices = [
 {style:1,font:signatureFonts[1],label:'Clássica · Caligrafia'},
 {style:3,font:signatureFonts[3],label:'Natural · Escrita à mão'},
 {style:5,font:signatureFonts[5],label:'Leve · Traço fino'},
] as const;
export function signatureStyle(consent?:string|null) {
 return Number(consent?.match(/Estilo de assinatura: ([0-5])/)?.[1] ?? 0);
}
export const signerRoles: Record<string,string> = {cliente:'Cliente',contratada:'Contratado',socio:'Sócio(a)',testemunha:'Testemunha'};
