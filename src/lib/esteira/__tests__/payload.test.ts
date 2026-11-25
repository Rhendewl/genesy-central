import { describe, expect, it } from "vitest";
import { parseAprendizadoPayload, parseDecisaoPayload, parseEventoPayload, parseItemPayload } from "../payload";

describe("parseItemPayload", () => {
  it("aceita um item completo e limpa espaços", () => {
    const r = parseItemPayload({ agente: "alfred", ref: "luna-live-park-01", titulo: "  3 criativos  de lançamento ", cliente: "Luna", etapa: "produzindo", progresso: 66.4, passo: "Gerando a variação 2 de 3", links: [{ label: "Prévia", url: "https://www.canva.com/design/x" }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.titulo).toBe("3 criativos de lançamento");
      expect(r.value.progresso).toBe(66);
      expect(r.value.links?.[0].label).toBe("Prévia");
    }
  });
  it("recusa agente, etapa, ref e progresso inválidos", () => {
    expect(parseItemPayload({ agente: "thomas", ref: "x" }).ok).toBe(false);
    expect(parseItemPayload({ agente: "bruce", ref: "x", etapa: "publicado" }).ok).toBe(false);
    expect(parseItemPayload({ agente: "bruce", ref: "com espaço" }).ok).toBe(false);
    expect(parseItemPayload({ agente: "bruce", ref: "x", progresso: 140 }).ok).toBe(false);
  });
  it("só aceita links https", () => {
    expect(parseItemPayload({ agente: "bruce", ref: "x", links: [{ url: "http://exemplo.com" }] }).ok).toBe(false);
    expect(parseItemPayload({ agente: "bruce", ref: "x", links: [{ url: "javascript:alert(1)" }] }).ok).toBe(false);
  });
  it("permite atualizar só a etapa (título vem do item existente)", () => {
    const r = parseItemPayload({ agente: "bruce", ref: "stories-vgv", etapa: "esperando" });
    expect(r.ok && r.value.titulo).toBe(undefined);
  });
});

describe("parseEventoPayload / parseAprendizadoPayload", () => {
  it("exige texto no evento", () => {
    expect(parseEventoPayload({ agente: "alfred", texto: " " }).ok).toBe(false);
    expect(parseEventoPayload({ agente: "alfred", texto: "Relatório enviado" }).ok).toBe(true);
  });
  it("proposta precisa de ref; regra não", () => {
    expect(parseAprendizadoPayload({ agente: "alfred", tipo: "proposta", texto: "Fachada à noite" }).ok).toBe(false);
    expect(parseAprendizadoPayload({ agente: "alfred", tipo: "proposta", ref: "exalt-fachada", texto: "Fachada à noite" }).ok).toBe(true);
    expect(parseAprendizadoPayload({ agente: "bruce", tipo: "regra", escopo: "stories", texto: "~30 palavras por story" }).ok).toBe(true);
  });
});

describe("parseDecisaoPayload", () => {
  it("ajuste precisa de nota; aprovação não", () => {
    expect(parseDecisaoPayload({ decisao: "aprovado" }).ok).toBe(true);
    expect(parseDecisaoPayload({ decisao: "ajuste" }).ok).toBe(false);
    expect(parseDecisaoPayload({ decisao: "ajuste", nota: "Trocar a foto da capa" }).ok).toBe(true);
    expect(parseDecisaoPayload({ decisao: "publicar" }).ok).toBe(false);
  });
});
