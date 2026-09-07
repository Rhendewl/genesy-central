import { describe, expect, it } from "vitest";
import { buildCommercialAnalysisEmail } from "@/lib/resend";

describe("buildCommercialAnalysisEmail", () => {
  it("usa a identidade da Genesy e descreve corretamente a coleta", () => {
    const html = buildCommercialAnalysisEmail({
      clientName: "Exalt Imóveis",
      collectionName: "Semana 1 · Qualidade dos leads",
      analysisLink: "https://go.genesycompany.com/analise-comercial/exalt",
      isTest: true,
    });

    expect(html).toContain("https://go.genesycompany.com/favicon.png");
    expect(html).toContain("A <strong style=\"color:#f2f3f4;\">Genesy</strong> está coletando percepções sobre os leads da");
    expect(html).toContain("Exalt Imóveis");
    expect(html).toContain("Semana 1 · Qualidade dos leads");
    expect(html).toContain("E-MAIL DE TESTE");
    expect(html).not.toContain("A <strong style=\"color:#fff;\">Exalt Imóveis</strong> está coletando");
  });

  it("escapa conteúdo dinâmico antes de inseri-lo no e-mail", () => {
    const html = buildCommercialAnalysisEmail({
      clientName: "Cliente <teste>",
      collectionName: "Rodada & revisão",
      analysisLink: "https://go.genesycompany.com/analise-comercial/teste",
    });

    expect(html).toContain("Cliente &lt;teste&gt;");
    expect(html).toContain("Rodada &amp; revisão");
    expect(html).not.toContain("Cliente <teste>");
  });
});
