import { describe, expect, it } from "vitest";
import {
  preserveFormListContext,
  readFormListContext,
  withFormListContext,
} from "@/lib/forms/navigation";

describe("navegação contextual de formulários", () => {
  it("restaura a pasta selecionada pela URL", () => {
    expect(readFormListContext(new URLSearchParams("folder=pasta-1&origin=standard")))
      .toEqual({ folder: "pasta-1", origin: "standard" });
  });

  it("preserva pasta e origem ao abrir páginas internas", () => {
    expect(withFormListContext("/formularios/form-1", {
      folder: "pasta-1",
      origin: "nps",
    })).toBe("/formularios/form-1?folder=pasta-1&origin=nps");
  });

  it("volta à raiz sem parâmetros desnecessários", () => {
    expect(withFormListContext("/formularios", {
      folder: "root",
      origin: "standard",
    })).toBe("/formularios");
  });

  it("transporta o contexto entre abas do formulário", () => {
    expect(preserveFormListContext(
      "/formularios/form-1/respostas",
      new URLSearchParams("folder=pasta-2"),
    )).toBe("/formularios/form-1/respostas?folder=pasta-2");
  });
});
