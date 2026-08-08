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
    "next-env.d.ts",
    // The Colyseus server is a separate package with its own dependencies,
    // tsconfig and lint run. The Next.js build must not reach into it — Vercel
    // only installs the root package.json, so server/node_modules doesn't
    // exist there and every import would fail to resolve.
    "server/**",
  ]),
]);

export default eslintConfig;
