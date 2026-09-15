import { describe, expect, it } from "vitest";
import { commercialAnalysisNotification, firstName, vgvSaleNotification } from "@/lib/notifications/marketing-alerts";

describe("marketing notification content", () => {
  it("formats the VGV sale notification for mobile", () => {
    expect(vgvSaleNotification({
      brokerName: "Miguel Santos",
      clientName: "LS Luna Corretor",
      developmentName: "Residencial Verão",
      saleValue: 1542000,
    })).toEqual({
      title: "Novo imóvel vendido",
      body: "Miguel Santos registrou uma venda de R$\u00a01.542.000,00 para LS Luna Corretor · Residencial Verão.",
    });
  });

  it("uses only the broker's first name in the commercial analysis title", () => {
    expect(firstName("  Maria Clara Souza ")).toBe("Maria");
    expect(commercialAnalysisNotification({
      brokerName: "Maria Clara Souza",
      clientName: "Cliente Exemplo",
      developmentName: "Parque das Águas",
    })).toEqual({
      title: "Maria respondeu análise comercial · Cliente Exemplo",
      body: "Empreendimento analisado: Parque das Águas.",
    });
  });
});
