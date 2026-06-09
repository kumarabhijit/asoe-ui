/**
 * Playwright configuration — COCKPIT-MODE browser e2e (cockpit-refactor).
 *
 * The cockpit redesign is gated by `cockpitEnabled()` (NEXT_PUBLIC_COCKPIT).
 * It can't be exercised by the shared mock-mode server (playwright.mock.
 * config.ts), because setting NEXT_PUBLIC_COCKPIT=1 there would flip the
 * cockpit on for EVERY mock spec — including the ones that pin the classic
 * layout. So the flag-on journey gets its OWN dedicated dev server (on a
 * separate port, with the flag set) and its own spec dir.
 *
 * Otherwise identical to mock mode: self-contained `next dev`, no backend,
 * `src/lib/api.ts` mock fixtures as the data source.
 *
 * Run: `npm run test:browser:cockpit`. CI: `.github/workflows/browser-e2e-cockpit.yml`.
 */
import { defineConfig, devices } from "@playwright/test";

// localhost (not 127.0.0.1) — see the note in playwright.config.ts about
// Next dev's allowedDevOrigins. Separate port from mock mode (3101) so the
// two servers can coexist locally.
const BASE_URL = process.env.E2E_COCKPIT_BASE_URL ?? "http://localhost:3102";

export default defineConfig({
  testDir: "tests/browser-cockpit",
  testMatch: ["**/*.spec.ts"],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report-cockpit", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    { name: "chromium-cockpit", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      name: "asoe-ui (next dev, cockpit flag on)",
      command: "next dev --port 3102",
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXTAUTH_URL: BASE_URL,
        NEXTAUTH_SECRET: "test-secret-browser-e2e-cockpit-only",
        // The whole point of this config: the cockpit redesign on.
        NEXT_PUBLIC_COCKPIT: "1",
        // No NEXT_PUBLIC_USE_REAL_API — mock data path, like the preview.
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
