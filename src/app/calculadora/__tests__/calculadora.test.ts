import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Calculadora from '../page';
import FlowCalculator from '@/components/calculadora/FlowCalculator';
import { parseMoneyInput } from '@/lib/flowPaymentMoney';

const mocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), loading: vi.fn(), pdf: vi.fn(), copy: vi.fn(), push: vi.fn(), scroll: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: mocks.success, loading: mocks.loading } }));
vi.mock('@/services/flowPaymentPdf', () => ({ generateFlowPaymentPDF: mocks.pdf }));
vi.mock('@/components/ui/button', () => ({ Button: ({ variant: _variant, size: _size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => React.createElement('button', props) }));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let container: HTMLDivElement;
let root: Root;
const input = (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)!;
const pdf = () => container.querySelector<HTMLButtonElement>('button[title="Exportar PDF"]')!;
const change = async (el: HTMLInputElement, value: string) => { await act(async () => { el.value = value; Simulate.change(el); }); };
const submit = async () => { await act(async () => { Simulate.submit(container.querySelector('form')!); }); };
const setupValid = async () => { await change(input('flow-project'), 'Vista Park Résidence'); await change(input('flow-total'), '500000'); };
const sharedText = () => { const link = container.querySelector<HTMLAnchorElement>('a[href^="https://wa.me/"]'); return link ? new URL(link.href).searchParams.get('text') ?? '' : ''; };
const currency = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

beforeEach(async () => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: mocks.scroll });
  mocks.copy.mockResolvedValue(undefined); mocks.pdf.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy } });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(React.createElement(Calculadora)));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

describe('calculadora — comportamento do formulário', () => {
  it('inicia com sliders e PDF desativados, sem resultado', () => {
    expect(Array.from(container.querySelectorAll<HTMLInputElement>('[type="range"]')).every(el => el.disabled)).toBe(true);
    expect(pdf().disabled).toBe(true);
    expect(container.querySelector('pre')).toBeNull();
    expect(input('flow-valor-Mensais').value).toBe('0,00');
    expect(input('flow-valor-Mensais').disabled).toBe(true);
  });
  it('valida nome e valor com os textos exigidos', async () => {
    await submit(); expect(mocks.error).toHaveBeenLastCalledWith('Indique o nome do empreendimento.');
    await change(input('flow-project'), 'Ceety Jardins'); await submit();
    expect(mocks.error).toHaveBeenLastCalledWith('Indique o valor total do imóvel.');
  });
  it('calcula em tempo real, avisa excesso/falta e permite confirmar ambos', async () => {
    await setupValid(); expect(parseMoneyInput(input('flow-valor-Mensais').value)).toBe(2604.17);
    const sliders = container.querySelectorAll<HTMLInputElement>('[type="range"]');
    await change(sliders[0], '30');
    expect(container.textContent).toContain('Defina no máximo 10%');
    expect(container.textContent).toContain('Defina no máximo 5%');
    await submit(); expect(pdf().disabled).toBe(false);
    await change(sliders[0], '10'); await change(sliders[1], '5');
    expect(container.textContent?.match(/Defina no mínimo/g)).toHaveLength(4);
    await submit(); expect(pdf().disabled).toBe(false);
    expect(container.textContent).not.toMatch(/consolidado/i);
  });
  it('invalida cada alteração exigida e mantém confirmação ao mudar unidade', async () => {
    await setupValid(); await submit();
    await change(input('flow-unit'), '101'); expect(pdf().disabled).toBe(false);
    expect(sharedText()).toContain('Unidade: 101');
    for (const [el, value] of [
      [input('flow-project'), 'Outro nome'], [input('flow-total'), '600000'],
      [input('flow-parcelas-Entrada'), '2'], [container.querySelector<HTMLInputElement>('[type="range"]')!, '15'],
    ] as const) {
      await change(el, value); expect(pdf().disabled).toBe(true); expect(container.querySelector('pre')).toBeNull(); await submit();
    }
  });
  it('normaliza parcelas vazias, negativas e fracionárias', async () => {
    for (const [value, expected] of [['', '1'], ['-2', '1'], ['3.5', '3']]) {
      await change(input('flow-parcelas-Entrada'), value); expect(input('flow-parcelas-Entrada').value).toBe(expected);
    }
  });
  it('gera texto exato, copia, restaura feedback e prepara link de WhatsApp', async () => {
    await setupValid(); await submit();
    const expected = `*Vista Park Résidence*\nValor total: ${currency(500000)}\n\n*Fluxo de pagamento*\n\n- *Entrada*: 10%\n  ${currency(50000)} (${currency(50000)})\n\n- *Mensais*: 25%\n  ${currency(125000)} em 48x de ${currency(125000 / 48)}\n\n- *Intercaladas*: 25%\n  ${currency(125000)} em 8x de ${currency(15625)}\n\n- *Chaves*: 40%\n  ${currency(200000)} (${currency(200000)})\n\n`;
    expect(sharedText()).toBe(expected);
    const link = container.querySelector<HTMLAnchorElement>('a[href^="https://wa.me/"]')!;
    expect(new URL(link.href).searchParams.get('text')).toBe(expected);
    vi.useFakeTimers();
    await act(async () => { Array.from(container.querySelectorAll('button')).find(b => /Copiar fluxo|Copiado!/.test(b.textContent ?? ''))!.click(); });
    expect(mocks.copy).toHaveBeenCalledWith(expected); expect(container.textContent).toContain('Copiado!');
    await act(async () => vi.advanceTimersByTime(2000)); expect(container.textContent).toContain('Copiar fluxo');
  });
  it('omite fases zero do WhatsApp e inclui as quatro fases no PDF', async () => {
    await setupValid(); await change(container.querySelector<HTMLInputElement>('[type="range"]')!, '0'); await submit();
    expect(sharedText()).not.toContain('*Entrada*');
    await act(async () => pdf().click());
    expect(mocks.pdf.mock.calls[0][0].rows).toHaveLength(4);
    expect(mocks.pdf.mock.calls[0][0].rows[0].pct).toBe(0);
    expect(mocks.loading).toHaveBeenCalledWith('Gerando PDF...', { id: 'pdf' });
    expect(mocks.success).toHaveBeenCalledWith('PDF exportado.', { id: 'pdf' });
  });
  it('informa falhas de PDF e de cópia', async () => {
    await setupValid(); await submit(); mocks.pdf.mockRejectedValueOnce(new Error('Falha teste'));
    await act(async () => pdf().click());
    expect(mocks.error).toHaveBeenCalledWith('Erro ao gerar PDF: Falha teste', { id: 'pdf' });
    mocks.copy.mockRejectedValueOnce(new Error('Sem permissão'));
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => /Copiar fluxo|Copiado!/.test(b.textContent ?? ''))!.click());
    expect(mocks.error).toHaveBeenLastCalledWith('Não foi possível copiar o fluxo. Tente novamente ou use o WhatsApp.');
  });
  it('edita o valor da parcela, recalcula o percentual e aplica a sugestão de equilíbrio', async () => {
    await setupValid(); await submit();
    await change(input('flow-valor-Mensais'), '1500,01');
    expect(pdf().disabled).toBe(true);
    expect(parseMoneyInput(input('flow-valor-Mensais').value)).toBe(1500.01);
    const target = Array.from(container.querySelectorAll('button')).find(b => b.getAttribute('aria-label')?.startsWith('Definir Entrada em '))!;
    await act(async () => target.click());
    expect(container.textContent).not.toContain('Defina no mínimo');
    expect(container.textContent).not.toContain('Defina no máximo');
    expect(parseMoneyInput(input('flow-valor-Mensais').value)).toBe(1500.01);
    await submit(); expect(pdf().disabled).toBe(false);
  });
  it('aceita percentuais acima de 100% derivados de valores e oferece correção', async () => {
    await setupValid(); await change(input('flow-valor-Mensais'), '12000');
    expect(container.textContent).toContain('115,2%');
    expect(container.textContent).toContain('Defina no máximo');
    expect(parseMoneyInput(input('flow-valor-Mensais').value)).toBe(12000);
  });
  it('leva cliente, corretor e CRECI ao WhatsApp e ao PDF e invalida após edição', async () => {
    await setupValid(); await submit();
    for (const [id, value] of [['flow-client', 'Marina Silva'], ['flow-broker', 'João Costa'], ['flow-creci', '12345-F / CE']]) {
      await change(input(id), value); expect(pdf().disabled).toBe(true); await submit();
    }
    const text = sharedText();
    expect(text).toContain('Cliente: Marina Silva'); expect(text).toContain('Corretor: João Costa'); expect(text).toContain('CRECI: 12345-F / CE');
    expect(text).not.toMatch(new RegExp('\\p{Extended_Pictographic}|\\uFFFD', 'u'));
    const shared = new URL(container.querySelector<HTMLAnchorElement>('a[href^="https://wa.me/"]')!.href).searchParams.get('text');
    expect(shared).toBe(text);
    await act(async () => pdf().click());
    expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({ clientName: 'Marina Silva', brokerName: 'João Costa', creci: '12345-F / CE' }));
  });

  it('formata milhares e centavos em todos os campos monetários sem alterar os cálculos', async () => {
    await setupValid();
    expect(input('flow-total').value).toBe('500.000');
    await act(async () => Simulate.blur(input('flow-total')));
    expect(input('flow-total').value).toBe('500.000,00');
    expect(input('flow-valor-Mensais').value).toBe('2.604,17');
    await change(input('flow-valor-Mensais'), '1.500,01');
    expect(input('flow-valor-Mensais').value).toBe('1.500,01');
    await submit();
    expect(sharedText()).toContain('48x de ' + currency(1500.01));
    await change(input('flow-total'), '600.000,50');
    expect(input('flow-valor-Chaves').value).toBe('240.000,20');
  });
  it('rola ao resultado em cada geração válida e mantém a mensagem somente no compartilhamento', async () => {
    await submit(); expect(mocks.scroll).not.toHaveBeenCalled();
    await setupValid(); await submit();
    expect(container.querySelector('#flow-result')).not.toBeNull();
    expect(container.querySelector('pre')).toBeNull();
    expect(container.textContent).not.toContain('*Fluxo de pagamento*');
    expect(mocks.scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    await submit(); expect(mocks.scroll).toHaveBeenCalledTimes(2);
    const mobilePdf = container.querySelector<HTMLButtonElement>('[aria-label="Imprimir PDF"]')!;
    expect(mobilePdf.disabled).toBe(false);
    await change(input('flow-valor-Mensais'), '1.500'); expect(mobilePdf.disabled).toBe(true);
  });

  it('mantém os dígitos ao inserir/remover algarismos junto dos separadores de milhar', async () => {
    for (const [raw, formatted] of [['1234', '1.234'], ['1.2345', '12.345'], ['12.3456', '123.456'], ['123.4567', '1.234.567'], ['1.234.567,', '1.234.567,'], ['1.234.567,8', '1.234.567,8'], ['1.234.567,89', '1.234.567,89'], ['1.23', '123']]) {
      await change(input('flow-total'), raw); expect(input('flow-total').value).toBe(formatted);
    }
    await act(async () => Simulate.paste(input('flow-total'), { clipboardData: { getData: () => '1500.01' } as unknown as DataTransfer }));
    expect(input('flow-total').value).toBe('1.500,01');
  });

  it('sliders avançam de 1 em 1% e a geração não exibe aviso', async () => {
    await setupValid();
    const slider = container.querySelector<HTMLInputElement>('[type="range"]')!;
    expect(slider.step).toBe('1');
    await change(slider, '21'); expect(slider.value).toBe('21');
    await submit(); expect(mocks.success).not.toHaveBeenCalled();
  });
  it('o modo público não oferece navegação de volta à plataforma', async () => {
    await act(async () => root.render(React.createElement(FlowCalculator, { publicMode: true })));
    expect(container.querySelector('[aria-label="Voltar ao início"]')).toBeNull();
    expect(container.querySelector('a[href="/"]')).toBeNull();
  });

});
