/**
 * Playwright configuration — MOCK-MODE browser e2e.
 *
 * The default `playwright.config.ts` drives the UI against a live asoe2
 * backend (`NEXT_PUBLIC_USE_REAL_API=1`). That is the right call for
 * most journeys, but it leaves a structural blind spot: the Vercel
 * PREVIEW — and every local `next dev` without a backend — runs in
 * MOCK mode, where `src/lib/api.ts`'s `MOCK_*` fixtures are the data
 * source. Two production bugs (Approve no-op; actions reverting on
 * reload) lived entirely in that mock path and were invisible to the
 * live-backend suite, because the live backend populated the missing
 * field / persisted to a DB.
 *
 * This config exercises the deployed mock data path directly:
 *   - ONE service: `next dev` on :3101 with NO NEXT_PUBLIC_USE_REAL_API
 *     (so api.ts takes its mock branches). No uvicorn, no Python, no
 *     asoe2 checkout — mock mode is self-contained by definition.
 *   - Specs live in `tests/browser-mock/` and drive the real UI against
 *     the seeded MOCK_EXCEPTIONS fixtures.
 *
 * Run: `npm run test:browser:mock`. CI: `.github/workflows/browser-e2e-mock.yml`.
 */
import { defineConfig, devices } from "@playwright/test";

// Use `localhost` (not 127.0.0.1) — Next 16 dev's allowedDevOrigins
// rejects 127.0.0.1, which blocks hydration and turns every click into
// a native form submit (full reload). See the note in playwright.config.ts.
const BASE_URL = process.env.E2E_MOCK_BASE_URL ?? "http://localhost:3101";

export default defineConfig({
  testDir: "tests/browser-mock",
  testMatch: ["**/*.spec.ts"],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Mock mode keeps no shared server state — each browser context gets
  // its own in-memory fixture + localStorage — so tests are independent.
  // We still pin workers=1 to avoid first-hit Next dev route-compile
  // thrash racing across workers on a cold server.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report-mock", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    { name: "chromium-mock", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      name: "asoe-ui (next dev, mock mode)",
      command: "next dev --port 3101",
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXTAUTH_URL: BASE_URL,
        NEXTAUTH_SECRET: "test-secret-browser-e2e-mock-only",
        // Deliberately NO NEXT_PUBLIC_USE_REAL_API — api.ts runs its
        // mock branches, exactly like the Vercel preview.
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
