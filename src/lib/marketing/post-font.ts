import localFont from "next/font/local";

// Bundle the editorial font with the generator so it is preloaded and versioned
// with the application instead of depending on a cached global font-face URL.
export const advercase = localFont({
  src: [
    { path: "../../../public/brand/advercase/Advercase-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../../public/brand/advercase/Advercase-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: true,
  fallback: ["Georgia", "serif"],
  adjustFontFallback: false,
});
