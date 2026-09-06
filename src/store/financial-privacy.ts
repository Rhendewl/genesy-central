import { create } from "zustand";

export const FINANCIAL_PRIVACY_STORAGE_KEY = "genesy-financial-values-hidden";
export const FINANCIAL_VALUE_MASK = "••••";

interface FinancialPrivacyStore {
  valuesHidden: boolean;
  hydrate: () => void;
  toggle: () => void;
}

export const useFinancialPrivacyStore = create<FinancialPrivacyStore>((set) => ({
  valuesHidden: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    set({ valuesHidden: window.localStorage.getItem(FINANCIAL_PRIVACY_STORAGE_KEY) === "true" });
  },
  toggle: () => set((state) => {
    const valuesHidden = !state.valuesHidden;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FINANCIAL_PRIVACY_STORAGE_KEY, String(valuesHidden));
    }
    return { valuesHidden };
  }),
}));

export function privateFinancialValue(formattedValue: string): string {
  return useFinancialPrivacyStore.getState().valuesHidden ? FINANCIAL_VALUE_MASK : formattedValue;
}
