import {it,expect} from 'vitest';
import {signatureStyle,signatureFonts,signatureChoices} from '../signature-styles';
import {fieldLabel} from '../fields';
it('preserves the font of previously signed documents while offering distinct new options',()=>{
 expect([0,1,2].map(n=>signatureFonts[signatureStyle(`Estilo de assinatura: ${n}.`)])).toEqual(['Allura','GreatVibes','Italianno']);
 expect(signatureChoices.map(c=>c.font)).toEqual(['GreatVibes','Caveat','ShadowsIntoLight']);
 expect(signatureFonts[signatureStyle('Estilo de assinatura: 4.')]).toBe('PermanentMarker');
 expect(signatureFonts[signatureStyle('Estilo de assinatura: 5.')]).toBe('ShadowsIntoLight');
});
it('formats field titles with accents and document acronyms',()=>{
 expect(fieldLabel('vigencia_por_extenso')).toBe('Vigência por Extenso');
 expect(fieldLabel('uf_assinatura')).toBe('UF Assinatura');
 expect(fieldLabel('comissao_percentual')).toBe('Comissão Percentual');
});
