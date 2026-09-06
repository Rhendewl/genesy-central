import { beforeEach, describe, expect, it } from "vitest";
import {
  FINANCIAL_PRIVACY_STORAGE_KEY,
  FINANCIAL_VALUE_MASK,
  privateFinancialValue,
  useFinancialPrivacyStore,
} from "@/store/financial-privacy";

describe("financial privacy", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useFinancialPrivacyStore.setState({ valuesHidden: false });
  });

  it("masks a formatted value when privacy is enabled", () => {
    useFinancialPrivacyStore.getState().toggle();

    expect(privateFinancialValue("R$ 12.500")).toBe(FINANCIAL_VALUE_MASK);
    expect(window.localStorage.getItem(FINANCIAL_PRIVACY_STORAGE_KEY)).toBe("true");
  });

  it("restores the saved preference", () => {
    window.localStorage.setItem(FINANCIAL_PRIVACY_STORAGE_KEY, "true");

    useFinancialPrivacyStore.getState().hydrate();

    expect(useFinancialPrivacyStore.getState().valuesHidden).toBe(true);
  });

  it("keeps the original formatting when privacy is disabled", () => {
    expect(privateFinancialValue("R$ 980")).toBe("R$ 980");
  });
});
