import { describe, expect, it } from "vitest";
import {
  buildDuplicateFormInsert,
  buildDuplicateIntegrationRows,
  copySlugCandidate,
} from "../duplicate-form";

describe("duplicate form", () => {
  it("inherits the entire definition but starts unpublished", () => {
    const original = {
      name: "Form. Genesy SITE",
      description: "Descrição",
      folder_id: "folder-1",
      theme: { primaryColor: "#000000" },
      settings: { allowBack: true },
      steps: [{ id: "step-1", type: "phone" as const, title: "Telefone", required: true }],
      logic_rules: [],
      welcome_screen: { enabled: true, title: "Olá", buttonText: "Começar" },
      endings: [{ id: "ending-1", title: "Obrigado" }],
      integrations: { crmEnabled: true },
      origin: "standard" as const,
      client_id: null,
    };

    const duplicate = buildDuplicateFormInsert(original, {
      userId: "user-1",
      slug: "formgenesysite-copia",
    });

    expect(duplicate).toMatchObject({
      name: "Form. Genesy SITE (cópia)",
      slug: "formgenesysite-copia",
      status: "draft",
      published_at: null,
      steps: original.steps,
      settings: original.settings,
      theme: original.theme,
      integrations: original.integrations,
    });
  });

  it("copies integration settings and secrets to the new form", () => {
    const rows = buildDuplicateIntegrationRows([{
      adapter: "crm",
      enabled: true,
      settings: { stage_id: "stage-1" },
      secrets: { token: "encrypted" },
      event_filter: null,
      retry_policy: { max_attempts: 3 },
      rate_limit: null,
    }], { formId: "new-form", userId: "user-1" });

    expect(rows[0]).toMatchObject({
      form_id: "new-form",
      user_id: "user-1",
      adapter: "crm",
      settings: { stage_id: "stage-1" },
      secrets: { token: "encrypted" },
    });
  });

  it("generates deterministic fallback slugs", () => {
    expect(copySlugCandidate("meu-form", 1)).toBe("meu-form-copia");
    expect(copySlugCandidate("meu-form", 3)).toBe("meu-form-copia-3");
  });
});
