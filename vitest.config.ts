/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Vitest picks up:
    //   - tests/**/*.test.{ts,tsx}  — RTL component, contract, arch tests
    //   - e2e/__tests__/**/*.test.{ts,tsx} — flow-runner infra unit tests
    //     (zod schema, codegen golden output, meta-test self-check). These
    //     are pure-Node TS tests; they live alongside the runner code so
    //     a refactor of the runner moves the tests with it (T1, W7).
    include: [
      "tests/**/*.test.{ts,tsx}",
      "e2e/__tests__/**/*.test.{ts,tsx}",
    ],
    // Playwright browser-driven specs live under tests/browser/ and
    // e2e/{contract,flows-generated}/ and are run by `npm run test:browser`.
    // Vitest must not pick them up — they use @playwright/test's test() +
    // page fixture which has a different runtime model.
    exclude: [
      "tests/browser/**",
      "e2e/contract/**",
      "e2e/flows-generated/**",
      "node_modules/**",
      "dist/**",
      ".next/**",
    ],
    css: false,
  },
});
