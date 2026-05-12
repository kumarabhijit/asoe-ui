#!/usr/bin/env node
// JUnit-to-Prometheus textfile exporter for the vitest CI matrix.
//
// Reads a vitest --reporter=junit XML at --input, emits a Prometheus
// textfile at --output. The §28.6 Grafana observability stack
// (asoe2/ops/observability/) scrapes the file via a Node-exporter
// textfile collector or via a CI artifact-to-Pushgateway bridge.
//
// Metrics emitted:
//
//   * tests_scenario_failed_total{scenario_id, slo_category, mode}  COUNTER
//       Incremented once per failed test. `scenario_id` defaults to
//       the JUnit `classname.name` joined by "::"; if the test's
//       failure message carries an explicit `scenario_id=<id>` token
//       (some parameterised tests do), that takes precedence.
//       `slo_category` defaults to `unknown`; opt-in tagging in
//       progress (tests/architectural/slo_category_tagging.test.ts
//       enforces shape, but per-test propagation lands incrementally).
//
//   * tests_total{mode}                                              GAUGE
//       Snapshot of how many tests ran in this mode.
//
//   * tests_passed_total{mode}                                       GAUGE
//   * tests_failed_total{mode}                                       GAUGE
//   * tests_skipped_total{mode}                                      GAUGE
//
// CLI:
//   node scripts/junit-to-prometheus.mjs --input <xml> --output <prom> --mode <mock|stub>
//
// Exit code is always 0 — the workflow runs this even on test
// failure (`if: always()`); a non-zero exit here would mask the
// underlying test failure in the workflow summary.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { argv, exit } from "node:process";

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--input") out.input = args[++i];
    else if (a === "--output") out.output = args[++i];
    else if (a === "--mode") out.mode = args[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function help() {
  console.error(
    "usage: junit-to-prometheus.mjs --input <junit.xml> --output <metrics.prom> --mode <mock|stub>\n" +
    "       Always exits 0 — surfaces errors via stderr.",
  );
}

const args = parseArgs(argv.slice(2));
if (args.help || !args.input || !args.output || !args.mode) {
  help();
  exit(0);
}

const VALID_MODES = new Set(["mock", "stub"]);
if (!VALID_MODES.has(args.mode)) {
  console.error(`[junit-to-prometheus] unknown mode "${args.mode}" — must be mock or stub`);
  exit(0);
}

// Defensive — vitest emits the JUnit file at the very end of the
// run, so on a crash before that point the file may not exist. We
// emit an "absent" metric so the dashboard distinguishes "no run"
// from "all-green run".
if (!existsSync(args.input)) {
  console.error(`[junit-to-prometheus] input file not found: ${args.input}`);
  writeFileSync(
    args.output,
    [
      "# HELP tests_junit_present 1 when the vitest JUnit report was found.",
      "# TYPE tests_junit_present gauge",
      `tests_junit_present{mode="${args.mode}"} 0`,
      "",
    ].join("\n"),
    "utf-8",
  );
  exit(0);
}

const xml = readFileSync(args.input, "utf-8");

// Lightweight tag-scan parser — JUnit XML from vitest is regular
// enough that we don't need a full DOM. Captures every <testcase>
// element with its attributes and its first <failure>/<skipped>
// child (the values we care about: classname, name, status).
//
// Why not pull a dep: this script runs in the CI image with no
// install step beyond `npm ci`; vitest does emit JUnit but no
// JUnit parser is in node_modules. Keeping it zero-dep avoids
// fighting the dep-cache for one file.
const TESTCASE_RE = /<testcase\s+([^>]*?)\/>|<testcase\s+([^>]*?)>([\s\S]*?)<\/testcase>/g;

function attrValue(attrs, key) {
  // Word boundary on the LEFT prevents `name=` from also matching
  // `classname=` (the bug that misaligned scenario_id labels in the
  // first cut of this exporter).
  const m = attrs.match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`));
  return m ? decodeXmlEntities(m[1]) : "";
}

// Decode the five XML entities that appear in attribute values.
// JUnit emitters escape `"` as `&quot;` etc. so the raw scan never
// breaks on attribute boundaries; we round-trip the decode here so
// the Prometheus label carries the actual characters (then
// `escapeLabel` re-escapes for Prometheus's own rules).
function decodeXmlEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

let total = 0;
let passed = 0;
let failed = 0;
let skipped = 0;
const failureLines = [];

for (const m of xml.matchAll(TESTCASE_RE)) {
  const attrs = m[1] ?? m[2] ?? "";
  const inner = m[3] ?? "";
  total += 1;

  const classname = attrValue(attrs, "classname");
  const name = attrValue(attrs, "name");
  const status = (inner.includes("<failure") || attrValue(attrs, "status") === "failed")
    ? "failed"
    : (inner.includes("<skipped") ? "skipped" : "passed");

  if (status === "failed") {
    failed += 1;
    // scenario_id default: classname::name. Override when the
    // failure message carries an explicit token (parameterised
    // tests can emit scenario_id=<id>).
    let scenarioId = `${classname}::${name}`;
    const scenarioMatch = inner.match(/scenario_id=([A-Z][A-Z0-9_]+__[a-z][a-z0-9_]+)/);
    if (scenarioMatch) scenarioId = scenarioMatch[1];
    // slo_category default: `unknown`. Tests opt in by including a
    // `slo_category=<band>` token in the failure message. This is
    // wired incrementally as parameterised tests carry the tag.
    let sloCategory = "unknown";
    const sloMatch = inner.match(/slo_category=(p99_blocker|p95_blocker|background)/);
    if (sloMatch) sloCategory = sloMatch[1];
    failureLines.push(
      `tests_scenario_failed_total{scenario_id="${escapeLabel(scenarioId)}",slo_category="${sloCategory}",mode="${args.mode}"} 1`,
    );
  } else if (status === "skipped") {
    skipped += 1;
  } else {
    passed += 1;
  }
}

function escapeLabel(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

const lines = [
  `# HELP tests_junit_present 1 when the vitest JUnit report was found.`,
  `# TYPE tests_junit_present gauge`,
  `tests_junit_present{mode="${args.mode}"} 1`,
  ``,
  `# HELP tests_total Snapshot of tests run in the most recent CI run.`,
  `# TYPE tests_total gauge`,
  `tests_total{mode="${args.mode}"} ${total}`,
  ``,
  `# HELP tests_passed_total Number of passing tests in the most recent CI run.`,
  `# TYPE tests_passed_total gauge`,
  `tests_passed_total{mode="${args.mode}"} ${passed}`,
  ``,
  `# HELP tests_failed_total Number of failing tests in the most recent CI run.`,
  `# TYPE tests_failed_total gauge`,
  `tests_failed_total{mode="${args.mode}"} ${failed}`,
  ``,
  `# HELP tests_skipped_total Number of skipped tests in the most recent CI run.`,
  `# TYPE tests_skipped_total gauge`,
  `tests_skipped_total{mode="${args.mode}"} ${skipped}`,
  ``,
];

if (failureLines.length > 0) {
  lines.push(
    `# HELP tests_scenario_failed_total Counter: one observation per failed test, labelled by scenario_id, slo_category, and mode.`,
    `# TYPE tests_scenario_failed_total counter`,
    ...failureLines,
    ``,
  );
}

writeFileSync(args.output, lines.join("\n"), "utf-8");

console.error(
  `[junit-to-prometheus] mode=${args.mode} ` +
  `total=${total} passed=${passed} failed=${failed} skipped=${skipped} ` +
  `-> ${args.output}`,
);
exit(0);
