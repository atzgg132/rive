import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    // Generated/user-owned artifacts are not application source.
    ".claude/**",
    ".commandcode/**",
    "docs/audit/**",
    "graphify-out/**",
    "launch-film/**",
    "pitch-deck/**",
    "tmp/**",
    "scripts/seed-agnik-demo.mjs",
  ]),
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/components/marketing/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["gsap", "gsap/*", "motion", "motion/*"],
              message: "Animation libraries are isolated to src/components/marketing so they never enter the product bundle.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
