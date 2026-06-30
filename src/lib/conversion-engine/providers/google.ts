import { registerConversionProvider, type ConversionProvider } from "../registry";

// Google Ads conversion provider. Wired in Phase 4.
export const googleConversionProvider: ConversionProvider = {
  platform: "google_ads",
  async execute(_conversion, _event, _context) {
    // Wired in a future phase.
  },
};

registerConversionProvider(googleConversionProvider);
