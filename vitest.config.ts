/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// JSDoc parser-trap investigation (2026-05-10) — recorded so the
// next session does not retry the same dead end.
//
// vite-8 ships oxc as the default TS/JSX transformer. oxc closes
// a /** ... */ comment at the first **/ sequence (commonly via a
// glob like src/app/**/page.tsx in JSDoc), where tsc / prettier /
// the LSP all walk past it. This is the bug recorded in
// tests/architectural/jsdoc_parser_traps.test.ts.
//
// Attempted structural fixes:
//
//   1. `oxc: false` at the root of this config. Does NOT stick:
//      @vitejs/plugin-react's config() hook sets
//      `{ oxc: { jsx: { refresh: false } } }` and Vite merges that
//      AFTER the user config, re-enabling oxc.
//
//   2. Swap @vitejs/plugin-react -> @vitejs/plugin-react-swc. SWC
//      exhibits the SAME trap (different plugin name, same bug):
//      "Expected ';', '}' or <eof>" at the **/.
//
//   3. esbuild fallback. Not viable in vite-8: esbuild is no
//      longer installed as a direct dep; switching back requires
//      a custom plugin and loses HMR plumbing the React plugin
//      provides.
//
// Conclusion: the entire fast-TS-transformer ecosystem shares the
// **/ bug. The durable fix is the lint guard
// (tests/architectural/jsdoc_parser_traps.test.ts) plus the rule
// recorded in CLAUDE.md, NOT a transformer swap. Leave oxc as the
// default; the guard catches the trap before it reaches the
// transformer.

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
