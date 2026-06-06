/**
 * Deliverable lock (Pattern A) — Autonomy & Review Quality console (Phase 4
 * real-data slice). Behavioural tests can't catch "the surface was supposed to
 * ship but wasn't built", so this asserts the wiring AND the honesty contract:
 * the console reads the real reviewer-activity SLIs, gates to manager+/admin
 * (mirroring the backend), and renders the two no-data-source surfaces as
 * explicit "not measurable yet" cards rather than fabricated charts.
 *
 * Verify by deleting the route or the panel locally — this must fail.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf-8");

describe("Autonomy & Review Quality deliverable", () => {
  it("the route + panel files exist", () => {
    expect(existsSync(join(ROOT, "src", "app", "settings", "autonomy", "page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "src", "components", "ui", "ReviewQualityPanel.tsx"))).toBe(true);
  });

  it("the route mounts the panel, gates manager+/admin, and fetches the real SLIs", () => {
    const page = read("src", "app", "settings", "autonomy", "page.tsx");
    expect(page).toContain("ReviewQualityPanel");
    // RBAC gate mirrors backend require_role("manager","admin") — analysts lack
    // exceptions:override.
    expect(page).toContain("PERMISSIONS.EXCEPTIONS_OVERRIDE");
    expect(page).toContain("metricsApi");
    expect(page).toContain("getReviewerActivity");
  });

  it("the api client exposes the read endpoint (mock + real)", () => {
    const api = read("src", "lib", "api.ts");
    expect(api).toContain("getReviewerActivity");
    expect(api).toContain("/api/v1/metrics/reviewer-activity");
  });

  it("the panel renders honest no-data-source surfaces, not fabricated charts", () => {
    const panel = read("src", "components", "ui", "ReviewQualityPanel.tsx");
    expect(panel).toMatch(/Straight-through-processing/i);
    expect(panel).toMatch(/Calibration reliability/i);
    expect(panel).toMatch(/No data source yet/i);
  });

  it("the route is registered for the authenticated axe sweep", () => {
    const routes = read("e2e", "contract", "authenticated-routes.ts");
    expect(routes).toContain("/settings/autonomy");
  });

  it("Settings links to the console", () => {
    const settings = read("src", "app", "settings", "page.tsx");
    expect(settings).toContain("/settings/autonomy");
  });
});
