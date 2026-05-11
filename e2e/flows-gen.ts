// flows:gen CLI — generates Playwright .spec.ts files from
// e2e/flows/**/*.yaml into e2e/flows-generated/.
//
// Decision A1 (docs/test-strategy/e2e-flow-plan.md):
//
//   "e2e/flow-codegen.ts reads e2e/flows/**/*.yaml at build time,
//    validates each via a zod schema (e2e/flow-schema.ts), and
//    emits one .spec.ts file per flow into e2e/flows-generated/.
//    Run via `bun run flows:gen` (and as a pre-commit hook).
//    Generated specs are real Playwright tests with normal stack
//    traces, normal IDE jump-to-definition, normal Playwright UI
//    mode debugging."
//
// Behaviour:
//   1. Walk e2e/flows/ recursively for .yaml files (skip
//      underscore-prefixed registry files, skip JOURNEYS.md).
//   2. Parse each via flowSchema.parse() — validation errors
//      surface the YAML file path + zod issue path.
//   3. Codegen via generateSpec() — golden output locked by
//      e2e/__tests__/flow-codegen.test.ts.
//   4. Write one file per flow into e2e/flows-generated/,
//      preserving the source's category subdirectory
//      (triage/inbox-load.yaml -> triage/inbox-load.spec.ts).
//   5. Diff mode: --check exits non-zero if the generated tree
//      would change. Used by CI / pre-commit hook.
//
// Composability:
//   - Reuses loadFlows() from journey-matrix.ts so the discovery
//     logic lives in one place.
//   - The flow-discovery test exercises the parse+codegen path;
//     this CLI is the persistence side.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { generateSpec } from "./flow-codegen";

const HERE = dirname(fileURLToPath(import.meta.url));
const FLOWS_ROOT = join(HERE, "flows");
const GEN_ROOT = join(HERE, "flows-generated");

interface FlowFile {
  absPath: string;
  // Relative to FLOWS_ROOT: e.g. "triage/inbox-load.yaml".
  rel: string;
}

function listFlowFiles(): FlowFile[] {
  const out: FlowFile[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry.startsWith("_")) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
        out.push({
          absPath: full,
          rel: relative(FLOWS_ROOT, full).split(sep).join("/"),
        });
      }
    }
  }
  walk(FLOWS_ROOT);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

function specPathFor(flow: FlowFile): string {
  const rel = flow.rel.replace(/\.ya?ml$/, ".spec.ts");
  return join(GEN_ROOT, rel);
}

// Source-relative path for the spec's header comment.
function sourceRefFor(flow: FlowFile): string {
  return `e2e/flows/${flow.rel}`;
}

interface GeneratedSpec {
  outPath: string;
  spec: string;
}

function generateAll(): GeneratedSpec[] {
  const out: GeneratedSpec[] = [];
  for (const flow of listFlowFiles()) {
    const yamlText = readFileSync(flow.absPath, "utf-8");
    let raw: unknown;
    try {
      raw = YAML.parse(yamlText);
    } catch (e) {
      throw new Error(`YAML parse failed for ${flow.rel}: ${e}`);
    }
    let spec: string;
    try {
      spec = generateSpec({
        rawFlow: raw,
        sourcePath: sourceRefFor(flow),
      }).spec;
    } catch (e) {
      throw new Error(`Codegen failed for ${flow.rel}: ${e}`);
    }
    out.push({ outPath: specPathFor(flow), spec });
  }
  return out;
}

function readCurrentTree(): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(GEN_ROOT)) return out;
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry === ".gitkeep") continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith(".spec.ts")) {
        out.set(full, readFileSync(full, "utf-8"));
      }
    }
  }
  walk(GEN_ROOT);
  return out;
}

function writeTree(specs: GeneratedSpec[]) {
  // Wipe and rewrite — the directory is fully derived from
  // e2e/flows/. Any orphan file is stale and must not linger.
  if (existsSync(GEN_ROOT)) {
    rmSync(GEN_ROOT, { recursive: true, force: true });
  }
  mkdirSync(GEN_ROOT, { recursive: true });
  for (const { outPath, spec } of specs) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, spec);
  }
}

function diffTree(specs: GeneratedSpec[], current: Map<string, string>): string[] {
  const diffs: string[] = [];
  const wantedByPath = new Map(specs.map((s) => [s.outPath, s.spec]));

  // Files we expect but the tree is missing or stale.
  for (const { outPath, spec } of specs) {
    const have = current.get(outPath);
    if (have === undefined) {
      diffs.push(`+ ${relative(HERE, outPath)} (missing)`);
    } else if (have !== spec) {
      diffs.push(`~ ${relative(HERE, outPath)} (stale)`);
    }
  }
  // Files the tree has but we no longer expect.
  for (const path of current.keys()) {
    if (!wantedByPath.has(path)) {
      diffs.push(`- ${relative(HERE, path)} (orphan)`);
    }
  }
  return diffs;
}

function main() {
  const check = process.argv.includes("--check");
  const specs = generateAll();

  if (check) {
    const current = readCurrentTree();
    const diffs = diffTree(specs, current);
    if (diffs.length > 0) {
      console.error(
        "[flows:gen] e2e/flows-generated/ is out of sync. Run `npm run flows:gen` and commit.",
      );
      for (const d of diffs) console.error("  " + d);
      process.exit(1);
    }
    console.log("[flows:gen] e2e/flows-generated/ is up to date.");
    return;
  }

  writeTree(specs);
  console.log(`[flows:gen] wrote ${specs.length} spec files to e2e/flows-generated/`);
}

// Run when invoked directly (npx tsx e2e/flows-gen.ts).
if (
  typeof import.meta.url === "string" &&
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  main();
}

// Re-export helpers for the drift-detection vitest test.
export { generateAll, readCurrentTree, diffTree };
