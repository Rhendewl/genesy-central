import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createWorkspaceNotePDF, notePdfBlocks, type NotePdfAssets } from '../workspace-note-pdf';
const assets:NotePdfAssets={logo:'data:image/png;base64,'+readFileSync('public/brand/verified-badge.png').toString('base64'),regularFont:readFileSync('public/brand/tt-firs-neue-light.ttf').toString('base64'),boldFont:readFileSync('public/brand/tt-firs-neue-medium.ttf').toString('base64'),images:{}};
const p=(text:string)=>({type:'paragraph',content:[{type:'text',text}]});
describe('PDF mobile de Notas',()=>{
  it('preserva títulos, marcas, listas e divisórias do editor',()=>{
    const blocks=notePdfBlocks({type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Título'}]}, {type:'paragraph',content:[{type:'text',text:'Destaque',marks:[{type:'bold'},{type:'underline'}]}]},{type:'horizontalRule'},{type:'orderedList',attrs:{start:3},content:[{type:'listItem',content:[p('Item')]}]}]});
    expect(blocks[0].level).toBe(2);expect(blocks[1].runs?.[0]).toMatchObject({bold:true,underline:true});expect(blocks[2].type).toBe('break');expect(blocks[3].prefix).toBe('3. ');
  });
  it('gera páginas 108 × 192 mm e não cria páginas vazias por divisórias repetidas/finais',()=>{
    const doc=createWorkspaceNotePDF('Nota de relacionamento',{type:'doc',content:[p('Primeira página'),{type:'horizontalRule'},{type:'horizontalRule'},p('Segunda página'),{type:'horizontalRule'}]},assets);
    expect(doc.getNumberOfPages()).toBe(2);expect(doc.internal.pageSize.getWidth()).toBeCloseTo(108);expect(doc.internal.pageSize.getHeight()).toBeCloseTo(192);
    expect(doc.output().startsWith('%PDF-')).toBe(true);
  });
  it('continua textos longos sem exceder a altura das páginas',()=>{
    const doc=createWorkspaceNotePDF('Nota longa',{type:'doc',content:[p('Texto legível para celular. '.repeat(150))]},assets);
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
  });
});
