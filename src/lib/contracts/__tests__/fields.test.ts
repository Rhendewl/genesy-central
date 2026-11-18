import { describe,it,expect } from 'vitest';
import {derivedFields,money,numeric,words,fieldGroup,today} from '../fields';
describe('contract derived values',()=>{
 it('preserves Brazilian decimal values',()=>{expect(money('1234,5')).toBe('1.234,50');expect(numeric('1.234,50')).toBe(1234.5);});
 it('derives term and currency without trusting typed extended text',()=>{expect(derivedFields('{{meses}} {{meses_extenso}} {{valor_extenso}}',{meses:'12',meses_extenso:'errado',valor:'1.234,50'})).toMatchObject({meses_extenso:'doze',valor_extenso:'mil duzentos e trinta e quatro reais e cinquenta centavos'});});
 it('handles hundreds and invalid numbers',()=>{expect(words(100)).toBe('cem');expect(words(101)).toBe('cento e um');expect(words(-1)).toBe('');});
 it('keeps related witness data together',()=>expect(fieldGroup('testemunha_1_nome')).toBe(fieldGroup('testemunha_1_cpf')));
 it('resolves the real template aliases and groups commission together',()=>{
   const r=derivedFields('{{mensalidade_valor}} {{mensalidade_por_extenso}} {{comissao_percentual}} {{comissao_por_extenso}} {{vigencia_meses}} {{vigencia_por_extenso}} {{data_assinatura_por_extenso}}', {mensalidade_valor:'2.000,00',comissao_percentual:'5',vigencia_meses:'3'});
   expect(r.mensalidade_por_extenso).toBe('dois mil reais');
   expect(r.comissao_por_extenso).toBe('cinco');
   expect(r.vigencia_por_extenso).toBe('três');
   expect(r.data_assinatura_por_extenso).toContain(' de ');
   expect(r.data_assinatura).toBe(today());
   expect(fieldGroup('comissao_por_extenso')).toBe('Valores e pagamento');
 });
 it('prefills local data and respects explicit overrides',()=>{
   expect(derivedFields('{{cidade_assinatura}} {{uf_assinatura}} {{foro_estado}}',{})).toMatchObject({cidade_assinatura:'João Pessoa',uf_assinatura:'PB',foro_estado:'Paraíba'});
   expect(derivedFields('{{foro_cidade}}',{foro_cidade:'Recife'}).foro_cidade).toBe('Recife');
 });
 it('does not retain stale extended text when a number is removed',()=>{
   expect(derivedFields('{{vigencia_meses}} {{vigencia_por_extenso}}',{vigencia_meses:'',vigencia_por_extenso:'antigo'}).vigencia_por_extenso).toBe('');
 });

 it('derives the term when the saved template repeats the numeric placeholder',()=>{
   const r=derivedFields('{{vigencia_meses}} ({{vigencia_por_extenso}}) meses; renovação após {{vigencia_meses}} meses.',{vigencia_meses:'12'});
   expect(r.vigencia_por_extenso).toBe('doze');
 });
 it('uses only the signer list for the witness placeholders',()=>{
   const r=derivedFields('{{testemunha_1_nome}} {{testemunha_1_cpf}} {{testemunha_2_nome}} {{testemunha_2_cpf}}',{testemunha_1_nome:'Valor antigo'},[
    {role:'cliente',name:'Cliente'}, {role:'testemunha',name:'Gabi',document:'12345678901'}, {role:'testemunha',name:'Alex'},
   ]);
   expect(r).toMatchObject({testemunha_1_nome:'Gabi',testemunha_1_cpf:'12345678901',testemunha_2_nome:'Alex',testemunha_2_cpf:''});
 });

 it('fills numbered contracting-party fields from their own signer rows',()=>{
  expect(derivedFields('{{contratante_1_nome}} {{contratante_2_nome}} {{contratante_2_documento}}',{},[{role:'cliente',name:'Principal',document:'111'},{role:'testemunha',name:'Testemunha'},{role:'cliente',name:'Adicional',document:'222'}])).toMatchObject({contratante_1_nome:'Principal',contratante_2_nome:'Adicional',contratante_2_documento:'222'});
 });

});
