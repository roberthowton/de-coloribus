/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig(
  {
    test: {
      environment: "happy-dom",
      globals: true,
      include: ["**/__tests__/**/*.test.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        reportsDirectory: "./coverage",
        include: ["src/**/*.{ts,astro}"],
        exclude: [
          "**/*.d.ts",
          "**/*.test.*",
          "src/env.d.ts",
          "src/types.ts",
          "src/pages/**",
          "src/styles/**",
          "src/utils/behaviors/index.ts",
          "dist/",
        ],
      },
    },
  },
  {
    site: "https://coloribus.roberthowton.com/",
    trailingSlash: "always",
  },
);
