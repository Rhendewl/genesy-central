import { registerConversionProvider, type ConversionProvider } from "../registry";

// TikTok Pixel provider. Wired in Phase 4.
export const tiktokConversionProvider: ConversionProvider = {
  platform: "tiktok_pixel",
  async execute(_conversion, _event, _context) {
    // Wired in a future phase.
  },
};

registerConversionProvider(tiktokConversionProvider);
