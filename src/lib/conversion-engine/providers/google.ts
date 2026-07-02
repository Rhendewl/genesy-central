import { registerConversionProvider, type ConversionProvider } from "../registry";

// Google Ads / Enhanced Conversions provider. Wired in a future phase.
// ConversionEvent will supply all match keys, attribution and commerce fields.
export const googleConversionProvider: ConversionProvider = {
  platform: "google_ads",
  async execute(_conversion, _conversionEvent, _context) {
    // Wired in a future phase.
  },
};

registerConversionProvider(googleConversionProvider);
