/**
 * Architectural Fitness Test: Guardrail #2 — No Hardcoded Enum Values
 *
 * Mirrors asoe2/tests/test_v1_guardrails.py Guardrail #2.
 *
 * Scans all .tsx files in src/app/ for hardcoded intent or lifecycle state
 * string literals used in filter options, display labels, or conditional rendering.
 *
 * ALLOWED:
 * - Visual mapping functions with default fallback (Badge.tsx verdictVariant/lifecycleVariant)
 * - Type definitions in src/types/ (compile-time safety)
 * - Test fixtures in tests/ (test data)
 * - Comments and documentation strings
 *
 * FORBIDDEN:
 * - <option value="DUPLICATE_PO"> in page code
 * - if (intent === "CREDIT_BLOCK") in page logic
 * - Hardcoded filter dropdown values in page components
 */

import * as fs from "fs";
import * as path from "path";

const INTENT_LITERALS = [
  "CONTRACTUAL_CORRECTION",
  "CREDIT_BLOCK",
  "MASS_PRICING_ERROR",
  "DUPLICATE_PO",
];

const LIFECYCLE_LITERALS = [
  "INGESTED",
  "CLASSIFYING",
  "AUDITING",
  "PENDING_REVIEW",
  "ESCALATED",
  "EXECUTING",
  "RESOLVED",
  "FAILED",
  "BLOCKED",
  "REJECTED",
  "CLOSED",
];

/** Directories where hardcoded values are forbidden */
const SCAN_DIRS = ["src/app"];

/** Files where visual mapping is allowed (Badge variant functions) */
const ALLOWED_FILES = [
  "src/components/ui/Badge.tsx",
  "src/components/ui/AgentReasoningCard.tsx",
  "src/components/ui/ActivityIndicator.tsx",
  "src/components/ui/WaterfallStepper.tsx",
];

function findTsxFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsxFiles(fullPath));
    } else if (entry.name.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

function stripComments(content: string): string {
  // Remove single-line comments
  let stripped = content.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, "");
  return stripped;
}

describe("Guardrail #2: No Hardcoded Intent Values in Page Code", () => {
  const rootDir = path.resolve(__dirname, "../../");

  for (const scanDir of SCAN_DIRS) {
    const fullScanDir = path.join(rootDir, scanDir);
    if (!fs.existsSync(fullScanDir)) continue;

    const files = findTsxFiles(fullScanDir);

    for (const file of files) {
      const relativePath = path.relative(rootDir, file);

      it(`${relativePath} does not hardcode intent values in option/filter elements`, () => {
        const content = stripComments(fs.readFileSync(file, "utf-8"));

        for (const literal of INTENT_LITERALS) {
          // Check for hardcoded option values: <option value="DUPLICATE_PO">
          const optionPattern = new RegExp(`<option[^>]*value=["']${literal}["']`, "g");
          const matches = content.match(optionPattern);
          expect(matches).toBeNull();
        }
      });
    }
  }
});

describe("Guardrail #2: No Hardcoded Lifecycle States in Page Code", () => {
  const rootDir = path.resolve(__dirname, "../../");

  for (const scanDir of SCAN_DIRS) {
    const fullScanDir = path.join(rootDir, scanDir);
    if (!fs.existsSync(fullScanDir)) continue;

    const files = findTsxFiles(fullScanDir);

    for (const file of files) {
      const relativePath = path.relative(rootDir, file);

      it(`${relativePath} does not hardcode lifecycle states in option/filter elements`, () => {
        const content = stripComments(fs.readFileSync(file, "utf-8"));

        for (const literal of LIFECYCLE_LITERALS) {
          const optionPattern = new RegExp(`<option[^>]*value=["']${literal}["']`, "g");
          const matches = content.match(optionPattern);
          expect(matches).toBeNull();
        }
      });
    }
  }
});

describe("Guardrail #2: Badge variant functions have default fallback", () => {
  it("verdictVariant returns neutral for unknown values", () => {
    // Import dynamically to test actual implementation
    const { verdictVariant } = require("@/components/ui/Badge");
    expect(verdictVariant("UNKNOWN_VERDICT")).toBe("neutral");
    expect(verdictVariant(undefined)).toBe("neutral");
    expect(verdictVariant("")).toBe("neutral");
  });

  it("lifecycleVariant returns neutral for unknown values", () => {
    const { lifecycleVariant } = require("@/components/ui/Badge");
    expect(lifecycleVariant("NEW_FUTURE_STATE")).toBe("neutral");
    expect(lifecycleVariant(undefined)).toBe("neutral");
    expect(lifecycleVariant("")).toBe("neutral");
  });
});

describe("Guardrail #2: Exception Queue filters source from health endpoint", () => {
  it("Exception Queue page does not contain hardcoded intent option values", () => {
    const rootDir = path.resolve(__dirname, "../../");
    const pagePath = path.join(rootDir, "src/app/exceptions/page.tsx");
    const content = stripComments(fs.readFileSync(pagePath, "utf-8"));

    // Must contain useHealth() call
    expect(content).toContain("useHealth");

    // Must contain health?.allowed_intents or health?.lifecycle_states
    expect(content).toMatch(/health\??\.(allowed_intents|lifecycle_states)/);

    // Must NOT contain hardcoded intent option values
    for (const intent of INTENT_LITERALS) {
      expect(content).not.toMatch(new RegExp(`<option[^>]*value=["']${intent}["']`));
    }
  });
});
