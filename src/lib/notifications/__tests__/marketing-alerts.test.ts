import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistOperationalAlert } from "@/lib/notifications/operational-alert";
import { commercialAnalysisNotification, firstName, notifyCommercialAnalysisResponse, notifyVgvSale, vgvSaleNotification } from "@/lib/notifications/marketing-alerts";

vi.mock("@/lib/notifications/operational-alert", () => ({ persistOperationalAlert: vi.fn() }));

describe("marketing notification content", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("targets only administrators for VGV and commercial analysis notifications", async () => {
    vi.mocked(persistOperationalAlert).mockResolvedValue({ recipients: 1, created: 1, accepted: 1, failed: 0, noSubscription: 0 });

    await notifyVgvSale({} as never, {
      ownerUserId: "owner-1", saleId: "sale-1", brokerName: "Miguel Santos", clientName: "Cliente", developmentName: "Residencial", saleValue: 500000,
    });
    await notifyCommercialAnalysisResponse({} as never, {
      ownerUserId: "owner-1", responseId: "response-1", brokerName: "Maria Souza", clientName: "Cliente", clientId: "client-1", developmentName: "Residencial",
    });

    expect(persistOperationalAlert).toHaveBeenCalledTimes(2);
    expect(vi.mocked(persistOperationalAlert).mock.calls[0][1].roles).toEqual(["admin"]);
    expect(vi.mocked(persistOperationalAlert).mock.calls[1][1].roles).toEqual(["admin"]);
  });
});
