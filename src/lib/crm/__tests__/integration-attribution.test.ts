import {describe,it,expect} from 'vitest';
import {splitIntegrationNotes} from '../integration-attribution';
describe('lead attribution display',()=>{
 it('separates existing tracking lines without changing answers or source metadata',()=>{
 const notes='Formulário: Imóvel\nutm_source: meta\nutm_campaign: Casa A\nResponsável: Equipe\n\nQual imóvel deseja?\nCasa A\n\ngclid: abc';
 const r=splitIntegrationNotes(notes);
 expect(r.answers).toBe('Formulário: Imóvel\nResponsável: Equipe\n\nQual imóvel deseja?\nCasa A');
 expect(r.attribution).toEqual([{key:'utm_source',value:'meta'},{key:'utm_campaign',value:'Casa A'},{key:'gclid',value:'abc'}]);
 });
 it('preserves mentions of UTM inside normal answers',()=>{
 expect(splitIntegrationNotes('O que deseja?\nQuero entender utm_source: Google').answers).toContain('utm_source: Google');
 });
 it('separates humanized Meta tracking labels and campaign metadata from responses',()=>{
  const r=splitIntegrationNotes('Formulário: FORM VILLA REAL\nCampanha: Vila Real\nAnúncio: Vídeo Ana\nRespostas do formulário\nQuanto você ganha?: R$ 4.000\nUtm Source: facebook\nUtm Campaign: vila-real\nutm_source: facebook');
  expect(r.answers).toBe('Formulário: FORM VILLA REAL\nRespostas do formulário\nQuanto você ganha?: R$ 4.000');
  expect(r.attribution).toEqual([{key:'campanha',value:'Vila Real'},{key:'anúncio',value:'Vídeo Ana'},{key:'utm_source',value:'facebook'},{key:'utm_campaign',value:'vila-real'}]);
 });
 it('handles no tracking and no integration data',()=>{expect(splitIntegrationNotes(null)).toEqual({answers:'',attribution:[]});expect(splitIntegrationNotes('Resposta: Sim').attribution).toEqual([]);});
});
