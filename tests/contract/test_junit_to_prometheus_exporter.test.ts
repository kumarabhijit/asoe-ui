/**
 * JUnit→Prometheus exporter contract (S11).
 *
 * Locks the wire shape the §28.6 Grafana stack consumes:
 *   * `tests_scenario_failed_total{scenario_id, slo_category, mode}`
 *   * `tests_total{mode}`, tests_passed_total / failed_total / skipped_total
 *   * `tests_junit_present{mode}` gauge (distinguishes "no run" from
 *     "all-green run").
 *
 * The exporter runs zero-dep on the CI image; this test gives it a
 * unit-test harness so the regex tag-scan stays correct as vitest's
 * JUnit output evolves across major releases.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");
const SCRIPT = resolve(REPO_ROOT, "scripts/junit-to-prometheus.mjs");

const SAMPLE_JUNIT = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="vitest tests">
  <testsuite name="example suite" tests="4" failures="1" skipped="1" errors="0">
    <testcase classname="example.suite" name="all good" />
    <testcase classname="example.suite" name="terminal lock">
      <failure message="Expected terminal lifecycle gate; scenario_id=DUPLICATE_PO__high_value_needs_cosign slo_category=p99_blocker">stack</failure>
    </testcase>
    <testcase classname="example.suite" name="quietly skipped">
      <skipped />
    </testcase>
    <testcase classname="another.classname" name="passes too" />
  </testsuite>
</testsuites>
`;

describe("junit-to-prometheus exporter", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "junit-prom-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function run(mode: "mock" | "stub"): string {
    const input = join(dir, `junit-${mode}.xml`);
    const output = join(dir, `metrics-${mode}.prom`);
    writeFileSync(input, SAMPLE_JUNIT, "utf-8");
    execFileSync("node", [
      SCRIPT,
      "--input", input,
      "--output", output,
      "--mode", mode,
    ], { stdio: ["ignore", "ignore", "ignore"] });
    return readFileSync(output, "utf-8");
  }

  it("emits the present gauge with the mode label", () => {
    const out = run("mock");
    expect(out).toMatch(/tests_junit_present\{mode="mock"\} 1/);
  });

  it("emits total / passed / failed / skipped gauges", () => {
    const out = run("mock");
    expect(out).toMatch(/tests_total\{mode="mock"\} 4/);
    expect(out).toMatch(/tests_passed_total\{mode="mock"\} 2/);
    expect(out).toMatch(/tests_failed_total\{mode="mock"\} 1/);
    expect(out).toMatch(/tests_skipped_total\{mode="mock"\} 1/);
  });

  it("emits scenario_failed counter with scenario_id + slo_category from tokens", () => {
    const out = run("stub");
    expect(out).toMatch(
      /tests_scenario_failed_total\{scenario_id="DUPLICATE_PO__high_value_needs_cosign",slo_category="p99_blocker",mode="stub"\} 1/,
    );
  });

  it("emits zero scenario_failed lines when no tests failed", () => {
    const input = join(dir, "all-green.xml");
    const output = join(dir, "all-green.prom");
    writeFileSync(input, `<?xml version="1.0"?>
<testsuites>
  <testsuite>
    <testcase classname="a" name="b" />
    <testcase classname="a" name="c" />
  </testsuite>
</testsuites>`, "utf-8");
    execFileSync("node", [SCRIPT, "--input", input, "--output", output, "--mode", "mock"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    const txt = readFileSync(output, "utf-8");
    expect(txt).toMatch(/tests_failed_total\{mode="mock"\} 0/);
    expect(txt).not.toMatch(/tests_scenario_failed_total/);
  });

  it("missing input file yields present=0 (distinguishes no-run from all-green)", () => {
    const output = join(dir, "missing.prom");
    execFileSync("node", [
      SCRIPT,
      "--input", join(dir, "does-not-exist.xml"),
      "--output", output,
      "--mode", "mock",
    ], { stdio: ["ignore", "ignore", "ignore"] });
    const txt = readFileSync(output, "utf-8");
    expect(txt).toMatch(/tests_junit_present\{mode="mock"\} 0/);
    expect(txt).not.toMatch(/tests_total\{/);
  });

  it("escapes double-quotes and backslashes in label values", () => {
    const input = join(dir, "evil.xml");
    const output = join(dir, "evil.prom");
    writeFileSync(input, `<?xml version="1.0"?>
<testsuites><testsuite>
  <testcase classname="a&quot;b" name="c\\d">
    <failure message="boom">trace</failure>
  </testcase>
</testsuite></testsuites>`, "utf-8");
    execFileSync("node", [SCRIPT, "--input", input, "--output", output, "--mode", "mock"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    const txt = readFileSync(output, "utf-8");
    // Backslashes and quotes must be escaped so Prometheus doesn't
    // misparse the line.
    expect(txt).toMatch(/scenario_id="a\\"b::c\\\\d"/);
  });

  it("rejects an unknown mode without crashing", () => {
    // Should print to stderr and exit 0 (workflow runs even on
    // failure). We assert by checking the output file is NOT
    // created — the script returns before writing.
    const output = join(dir, "should-not-be-written.prom");
    execFileSync("node", [
      SCRIPT,
      "--input", join(dir, "any.xml"),
      "--output", output,
      "--mode", "lol-unsupported",
    ], { stdio: ["ignore", "ignore", "ignore"] });
    // The file must not exist after the rejection.
    expect(() => readFileSync(output, "utf-8")).toThrow();
  });
});
