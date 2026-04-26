/**
 * Playwright configuration — browser-driven end-to-end tests that drive
 * the real asoe-ui dev server against a live asoe2 backend.
 *
 * Two services are spun up for every run via `webServer`:
 *   1. uvicorn (asoe2)   on localhost:8000  — FastAPI backend in sandbox mode
 *   2. next dev (asoe-ui) on localhost:3100 — with NEXT_PUBLIC_USE_REAL_API=1
 *
 * We use a non-default Next port (3100) so browser tests don't fight a
 * dev server a human is already running on 3000.
 *
 * The browser binary is the pre-installed Playwright chromium at
 * /opt/pw-browsers/chromium-1194, matched to @playwright/test@1.56.1.
 * In CI this is resolved the standard way via the GitHub Actions
 * workflow (`npx playwright install --with-deps chromium`); see
 * .github/workflows/browser-e2e.yml.
 */
import { defineConfig, devices } from "@playwright/test";

// Important: use `localhost` rather than `127.0.0.1`. Next 16 dev's
// `allowedDevOrigins` rejects 127.0.0.1 by default, which blocks the
// hydration scripts that drive React event handlers. Without hydration
// the form falls back to a native submit (page reload) and every click
// silently no-ops. `localhost` is in the default allowlist.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:8000";
const ASOE2_ROOT = process.env.ASOE2_ROOT ?? "../asoe2";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // The asoe2 backend uses an in-memory exception store and audit log
  // that is process-global. Specs reset tenant state between tests via
  // POST /_sandbox/tenant/reset; if two workers run concurrently, one
  // worker's reset wipes another worker's freshly-seeded exception and
  // the detail page renders "Exception not found". `fullyParallel: false`
  // alone only serializes tests *within* a file — files still parallelize
  // across workers. Pin workers=1 so the whole suite is serial against
  // the shared backend.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 5_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      name: "asoe2 (uvicorn)",
      command: `cd ${ASOE2_ROOT} && ASOE_ENV=sandbox PYTHONPATH=. uvicorn api.app:app --host 127.0.0.1 --port 8000 --log-level warning`,
      url: `${BACKEND_URL}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      name: "asoe-ui (next dev)",
      command: "next dev --port 3100",
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NEXTAUTH_URL: BASE_URL,
        NEXTAUTH_SECRET: "test-secret-browser-e2e-only",
        NEXT_PUBLIC_API_URL: BACKEND_URL,
        NEXT_PUBLIC_USE_REAL_API: "1",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
