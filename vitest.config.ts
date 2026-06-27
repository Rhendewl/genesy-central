import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals:     false, // explicit imports only — no magic globals
    include:     ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include:  [
        "src/lib/event-bus/**/*.ts",
        "src/lib/logic-engine/**/*.ts",
        "src/lib/analytics/**/*.ts",
        "src/lib/integrations/**/*.ts",
      ],
      exclude: [
        "src/lib/event-bus/index.ts",
        "src/lib/event-bus/form/index.ts",
        "src/lib/event-bus/form/consumers/analytics.ts",
        "src/lib/event-bus/observability.ts",
        "src/lib/logic-engine/index.ts",
        "src/lib/logic-engine/errors.ts",
        "src/lib/analytics/index.ts",
        "src/lib/integrations/index.ts",
        "**/__tests__/**",
        "**/types.ts",
      ],
      thresholds: {
        lines:      90,
        functions:  90,
        branches:   85,
        statements: 90,
      },
      reporter: ["text", "text-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
