import { registerConversionProvider, type ConversionProvider } from "../registry";

// TikTok Events API provider. Wired in a future phase.
// ConversionEvent will supply all match keys, attribution and commerce fields.
export const tiktokConversionProvider: ConversionProvider = {
  platform: "tiktok_pixel",
  async execute(_conversion, _conversionEvent, _context) {
    // Wired in a future phase.
  },
};

registerConversionProvider(tiktokConversionProvider);
