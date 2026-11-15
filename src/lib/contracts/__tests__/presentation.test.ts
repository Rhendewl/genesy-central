import {describe,it,expect} from 'vitest';
import {contractMainText} from '../presentation';
describe('contract signature layout',()=>{
 it('relayouts only the terminal signature list',()=>{
 const body='OBJETO\nTexto original\n\nCONTRATANTE\nCliente\nCPF/CNPJ: 123\nCONTRATADO\nGenesy\nCPF: 456\nTESTEMUNHA 01\nNome: Ana';
 expect(contractMainText(body)).toBe('OBJETO\nTexto original');
 });
 it('preserves party references and clauses that are not a final signature list',()=>{
 const body='CONTRATANTE\nCliente\nCONTRATADO\nEmpresa\nCLÁUSULA 1\nAs obrigações da TESTEMUNHA são...';
 expect(contractMainText(body)).toBe(body);
 });
});
