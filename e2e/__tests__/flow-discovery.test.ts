// Discovers every flow YAML under e2e/flows/ and runs the parser
// + codegen against each one. Surfaces broken YAML, schema
// violations, and codegen errors without waiting for Playwright.
//
// Why a discovery test in addition to the golden-output test:
//   - flow-codegen.test.ts pins ONE byte-for-byte snapshot to lock
//     codegen behaviour. It would not catch a YAML that fails to
//     parse — only a snapshot mismatch.
//   - This test is the inverse: it doesn't pin output, it pins
//     "every flow round-trips through the runner." Together the
//     two tests catch both runner regressions and per-flow rot.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import YAML from "yaml";
import { generateSpec } from "../flow-codegen";

const FLOWS_ROOT = join(__dirname, "..", "flows");

function listFlowFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      // Skip dotfiles and the underscore-prefixed registry file —
      // _registry.yaml is metadata, not a flow.
      if (entry.startsWith(".") || entry.startsWith("_")) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) out.push(full);
    }
  }
  walk(FLOWS_ROOT);
  return out;
}

describe("flow discovery", () => {
  const files = listFlowFiles();

  it("discovers at least one flow YAML", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const path of files) {
    const rel = relative(join(__dirname, ".."), path);
    it(`${rel} parses + validates + codegens`, () => {
      const text = readFileSync(path, "utf-8");
      const raw = YAML.parse(text);
      const { spec, flow } = generateSpec({
        rawFlow: raw,
        sourcePath: rel,
      });
      // Smoke checks on the generated text.
      expect(spec).toMatch(/^\/\/ AUTO-GENERATED/);
      expect(spec).toContain(`test.describe("${flow.name}"`);
      // The on-disk filename should match the flow.name (kebab-case).
      const basename = path.split("/").pop()!.replace(/\.ya?ml$/, "");
      expect(basename).toBe(flow.name);
    });
  }
});
