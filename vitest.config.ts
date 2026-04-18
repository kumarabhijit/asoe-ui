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
    include: ["tests/**/*.test.{ts,tsx}"],
    // Playwright browser-driven specs live under tests/browser/ and are
    // run by `npm run test:browser`. Vitest must not pick them up — they
    // use @playwright/test's test() + page fixture which has a different
    // runtime model.
    exclude: ["tests/browser/**", "node_modules/**", "dist/**", ".next/**"],
    css: false,
  },
});
