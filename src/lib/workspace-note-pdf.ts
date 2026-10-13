import { jsPDF } from 'jspdf';
import type { JSONContent } from '@tiptap/react';
import { deliverPdfBlob } from '@/lib/pdf-delivery';

type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; highlight?: boolean; href?: string };
export type NotePdfBlock = { type: 'text' | 'image' | 'table' | 'break'; runs?: Run[]; level?: number; indent?: number; prefix?: string; quote?: boolean; code?: boolean; src?: string; cells?: { runs: Run[]; header: boolean }[][] };
export type NotePdfAssets = { logo: string; regularFont: string; boldFont: string; images: Record<string, { data: string; width: number; height: number }>; emoji?: Record<string, string> };
function runs(node: JSONContent): Run[] {
  if (node.type === 'text') {
    const marks = node.marks ?? [];
    return [{ text: node.text ?? '', bold: marks.some(m => m.type === 'bold'), italic: marks.some(m => m.type === 'italic'), underline: marks.some(m => m.type === 'underline'), strike: marks.some(m => m.type === 'strike'), highlight: marks.some(m => m.type === 'highlight'), href: marks.find(m => m.type === 'link')?.attrs?.href }];
  }
  if (node.type === 'hardBreak') return [{ text: '\n' }];
  return (node.content ?? []).flatMap((child, index) => index > 0 && ['paragraph','heading'].includes(child.type ?? '') ? [{ text: '\n' }, ...runs(child)] : runs(child));
}
export function notePdfBlocks(content: JSONContent): NotePdfBlock[] {
  const blocks: NotePdfBlock[] = [];
  function walk(node: JSONContent, indent = 0, prefix = '', quote = false) {
    if (node.type === 'horizontalRule') { blocks.push({ type: 'break' }); return; }
    if (['paragraph','heading','codeBlock','detailsSummary'].includes(node.type ?? '')) {
      blocks.push({ type: 'text', runs: runs(node), indent, prefix, quote, level: node.type === 'heading' ? Math.min(3, Math.max(1, Number(node.attrs?.level) || 1)) : node.type === 'detailsSummary' ? 3 : undefined, code: node.type === 'codeBlock' }); return;
    }
    if (node.type === 'image') { if (node.attrs?.src) blocks.push({ type: 'image', src: node.attrs.src }); return; }
    if (node.type === 'noteAttachment') { blocks.push({ type: 'text', runs: [{ text: `Anexo: ${node.attrs?.fileName ?? 'Arquivo'}`, underline: true, href: node.attrs?.url }], indent }); return; }
    if (node.type === 'table') { blocks.push({ type: 'table', cells: (node.content ?? []).map(row => (row.content ?? []).map(cell => ({ runs: runs(cell), header: cell.type === 'tableHeader' }))) }); return; }
    if (['bulletList','orderedList','taskList'].includes(node.type ?? '')) {
      (node.content ?? []).forEach((item, index) => {
        const marker = node.type === 'orderedList' ? `${Number(node.attrs?.start ?? 1) + index}. ` : node.type === 'taskList' ? (item.attrs?.checked ? '[x] ' : '[ ] ') : '• ';
        (item.content ?? []).forEach((child, childIndex) => walk(child, indent + 1, childIndex === 0 ? marker : '', quote));
      }); return;
    }
    (node.content ?? []).forEach(child => walk(child, indent, prefix, quote || node.type === 'blockquote'));
  }
  walk(content); return blocks;
}
function b64(buffer: ArrayBuffer) {
  let text = ''; const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  return btoa(text);
}
const emojiPattern = new RegExp('\\p{Extended_Pictographic}|\\p{Regional_Indicator}|\\u20e3', 'u');
function graphemes(text: string): string[] {
  return Array.from(new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(text), item => item.segment);
}
function emojiImage(text: string): string {
  const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 96;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar os ícones da nota.');
  context.font = '72px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; context.textBaseline = 'middle'; context.textAlign = 'center'; context.fillText(text, 48, 49);
  return canvas.toDataURL('image/png');
}
async function rasterAsset(src: string, logo = false) {
  const response = await fetch(src); if (!response.ok) throw new Error('Não foi possível carregar uma imagem da nota.');
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const image = new Image(); image.src = objectUrl; await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = logo ? 1370 : image.naturalWidth; canvas.height = logo ? 299 : image.naturalHeight;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar as imagens do PDF.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(objectUrl); }
}
export async function loadNotePdfAssets(content: JSONContent, title = ''): Promise<NotePdfAssets> {
  const sources = Array.from(new Set(notePdfBlocks(content).filter(b => b.type === 'image').map(b => b.src!)));
  const [logo, regular, bold, pictures] = await Promise.all([
    rasterAsset('/brand/genesy-all-preto.svg', true), fetch('/brand/tt-firs-neue-light.ttf'), fetch('/brand/tt-firs-neue-medium.ttf'),
    Promise.all(sources.map(async src => [src, await rasterAsset(src)] as const)),
  ]);
  if (!regular.ok || !bold.ok) throw new Error('Não foi possível carregar as fontes do PDF.');
  const text = title + ' ' + notePdfBlocks(content).flatMap(block => [...(block.runs ?? []), ...(block.cells ?? []).flatMap(row => row.flatMap(cell => cell.runs))]).map(run => run.text).join(' ');
  const emoji = Object.fromEntries(Array.from(new Set(graphemes(text).filter(char => emojiPattern.test(char)))).map(char => [char, emojiImage(char)]));
  return { emoji, logo: logo.data, regularFont: b64(await regular.arrayBuffer()), boldFont: b64(await bold.arrayBuffer()), images: Object.fromEntries(pictures) };
}

/** Vector text stays crisp when zooming on a phone; rules are explicit page breaks. */
export function createWorkspaceNotePDF(title: string, content: JSONContent, assets: NotePdfAssets): jsPDF {
  const W = 108, H = 192, M = 8, BOTTOM = 180;
  const doc = new jsPDF({ unit: 'mm', format: [W,H], orientation: 'portrait' });
  doc.setProperties({ title: title.trim() || 'Nota sem título', author: 'Genesy', subject: 'Nota do Workspace' });
  doc.addFileToVFS('note-regular.ttf', assets.regularFont); doc.addFont('note-regular.ttf', 'NoteBrand', 'normal');
  doc.addFileToVFS('note-bold.ttf', assets.boldFont); doc.addFont('note-bold.ttf', 'NoteBrand', 'bold');
  let y = 24; let pageHasContent = false;
  function header() {
    doc.setFillColor(250, 251, 252); doc.rect(0, 0, W, H, 'F');
    doc.addImage(assets.logo, 'PNG', M, 8, 29, 6.3);
    doc.setDrawColor(220,225,230); doc.line(M, 19, W-M, 19); y = 27; pageHasContent = false;
  }
  function newPage() { doc.addPage([W,H], 'portrait'); header(); }
  function ensure(height: number) { if (y + height > BOTTOM) newPage(); }
  function font(run: Run, size: number, bold: boolean, code: boolean) {
    doc.setFont(code ? 'courier' : run.italic ? 'helvetica' : 'NoteBrand', run.italic ? (bold || run.bold ? 'bolditalic' : 'italic') : bold || run.bold ? 'bold' : 'normal');
    doc.setFontSize(size); doc.setTextColor(25,30,35);
  }
  function paragraph(block: NotePdfBlock) {
    const level = block.level;
    const size = level ? [0,21,17,14][level] : block.code ? 10.5 : 12.5;
    const height = size * .3528 * 1.5;
    const xStart = M + Math.min(block.indent ?? 0, 6) * 4 + (block.quote ? 3 : 0);
    const right = W-M;
    ensure(level ? height * 2 + 5 : height);
    if (level && pageHasContent) y += 2;
    let x = xStart;
    const allRuns = block.prefix ? [{ text: block.prefix }, ...(block.runs ?? [])] : block.runs ?? [];
    const draw = (text: string, run: Run) => {
      font(run, size, !!level, !!block.code);
      const width = doc.getTextWidth(text);
      if (block.code) { doc.setFillColor(237,240,243); doc.rect(x, y-height*.8, width, height, 'F'); }
      if (run.highlight) { doc.setFillColor(255,238,150); doc.rect(x, y-height*.7, width, height*.85, 'F'); }
      if (block.quote) { doc.setDrawColor(155,168,180); doc.line(xStart-2, y-height*.75, xStart-2, y+height*.2); }
      if (run.href && /^https?:\/\//i.test(run.href)) { doc.setTextColor(40,98,153); doc.textWithLink(text, x, y, { url: run.href }); }
      else doc.text(text, x, y);
      doc.setDrawColor(60,68,74);
      if (run.underline) doc.line(x, y+1, x+width, y+1);
      if (run.strike) doc.line(x, y-size*.12, x+width, y-size*.12);
      x += width; pageHasContent = true;
    };
    const lineBreak = () => { y += height; ensure(height); x = xStart; };
    for (const run of allRuns) for (const token of run.text.split(/(\n|[ \t]+)/).filter(Boolean).flatMap(token => emojiPattern.test(token) ? graphemes(token) : [token])) {
      if (assets.emoji?.[token]) {
        const em = size * .3528 * 1.15;
        if (x + em > right) lineBreak();
        doc.addImage(assets.emoji[token], 'PNG', x, y-em*.8, em, em); x += em; pageHasContent = true; continue;
      }
      if (token === '\n') { lineBreak(); continue; }
      font(run, size, !!level, !!block.code);
      const width = doc.getTextWidth(token);
      if (x + width > right && x > xStart) lineBreak();
      if (/^[ \t]+$/.test(token) && x === xStart) continue;
      if (width <= right-xStart) draw(token, run);
      else for (const char of Array.from(token)) { font(run,size,!!level,!!block.code); if (x + doc.getTextWidth(char) > right) lineBreak(); draw(char,run); }
    }
    y += height + (level ? 3 : 2.5);
  }
  header();
  paragraph({ type: 'text', level: 1, runs: [{ text: title.trim() || 'Nota sem título' }] });
  let pendingBreak = false;
  for (const block of notePdfBlocks(content)) {
    if (block.type === 'break') { pendingBreak = true; continue; }
    if (pendingBreak && pageHasContent) newPage();
    pendingBreak = false;
    if (block.type === 'text') paragraph(block);
    if (block.type === 'image') {
      const image = assets.images[block.src!]; if (!image) throw new Error('Uma imagem da nota não pôde ser incluída no PDF.');
      const width = Math.min(W-2*M, (BOTTOM-27) * image.width / image.height);
      const height = width * image.height / image.width; ensure(height + 3);
      doc.addImage(image.data, 'PNG', M, y, width, height); y += height + 5; pageHasContent = true;
    }
    if (block.type === 'table') for (const row of block.cells ?? []) {
      const cellWidth = (W-2*M) / Math.max(row.length,1);
      const lines = row.map(cell => { doc.setFont('NoteBrand',cell.header ? 'bold' : 'normal'); doc.setFontSize(10); return doc.splitTextToSize(cell.runs.map(r => r.text).join(''),cellWidth-4) as string[]; });
      let offset = 0; const total = Math.max(1,...lines.map(l => l.length));
      while (offset < total) {
        ensure(9); const fitting = Math.min(total-offset, Math.max(1,Math.floor((BOTTOM-y-4)/5))); const height = fitting*5+4;
        row.forEach((cell,index) => {
          const x = M+index*cellWidth; doc.setDrawColor(210,217,224); doc.setFillColor(...(cell.header ? [230,236,241] : [255,255,255]) as [number,number,number]); doc.rect(x,y,cellWidth,height,'FD');
          doc.setFont('NoteBrand',cell.header ? 'bold' : 'normal'); doc.setFontSize(10); doc.setTextColor(25,30,35); doc.text(lines[index].slice(offset,offset+fitting),x+2,y+5);
        });
        y += height; offset += fitting; pageHasContent = true; if (offset<total) newPage();
      }
      y += 2;
    }
  }
  const pages = doc.getNumberOfPages();
  for (let page=1; page<=pages; page++) { doc.setPage(page); doc.setFont('NoteBrand','normal'); doc.setFontSize(8); doc.setTextColor(125,135,145); doc.text(`${page} / ${pages}`,W-M,H-5,{align:'right'}); }
  return doc;
}
export async function exportWorkspaceNotePDF(title: string, content: JSONContent) {
  const assets = await loadNotePdfAssets(content, title);
  const doc = createWorkspaceNotePDF(title, content, assets);
  const safe = title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'Sem_titulo';
  return deliverPdfBlob(doc.output('blob'), `Nota_${safe}.pdf`, title || 'Nota Genesy');
}
