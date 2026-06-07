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
 *
 * FORBIDDEN:
 * - <option value="DUPLICATE_PO"> in page code
 * - Hardcoded filter dropdown values in page components
 */

import * as fs from "fs";
import * as path from "path";
import { verdictVariant, lifecycleVariant } from "@/components/ui/Badge";

const INTENT_LITERALS = [
  "CONTRACTUAL_CORRECTION",
  "CREDIT_BLOCK",
  "MASS_PRICING_ERROR",
  "DUPLICATE_PO",
  "PRICE_HOLD_RELEASE",
  "EDI_MISMATCH",
];

const LIFECYCLE_LITERALS = [
  "INGESTED",
  "CLASSIFYING",
  "AUDITING",
  "PENDING_REVIEW",
  "ESCALATED",
  "PENDING_ADMIN_REVIEW",
  "PENDING_COSIGN",
  "RESOLVED",
  "FAILED",
  "BLOCKED",
  "REJECTED",
  "CLOSED",
];

const SCAN_DIRS = ["src/app"];

function findTsxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
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
  let stripped = content.replace(/\/\/.*$/gm, "");
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, "");
  return stripped;
}

describe("Guardrail #2: No Hardcoded Intent Values in Page Code", () => {
  const rootDir = path.resolve(__dirname, "../../");

  for (const scanDir of SCAN_DIRS) {
    const fullScanDir = path.join(rootDir, scanDir);
    const files = findTsxFiles(fullScanDir);

    for (const file of files) {
      const relativePath = path.relative(rootDir, file);

      it(`${relativePath} does not hardcode intent values in option/filter elements`, () => {
        const content = stripComments(fs.readFileSync(file, "utf-8"));

        for (const literal of INTENT_LITERALS) {
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
    expect(verdictVariant("UNKNOWN_VERDICT")).toBe("neutral");
    expect(verdictVariant(undefined)).toBe("neutral");
    expect(verdictVariant("")).toBe("neutral");
  });

  it("lifecycleVariant returns neutral for unknown values", () => {
    expect(lifecycleVariant("NEW_FUTURE_STATE")).toBe("neutral");
    expect(lifecycleVariant(undefined)).toBe("neutral");
    expect(lifecycleVariant("")).toBe("neutral");
  });
});

describe("Guardrail #2: Dashboard routes verdict→colour through the mapper", () => {
  it("dashboard/page.tsx does not branch on raw shadow-verdict literals for colour", () => {
    // REGRESSION (fails on parent): the verdict-distribution bar picked its
    // colour with `verdict === "GREEN" ? … : verdict === "YELLOW" ? …`,
    // duplicating verdictVariant() and hardcoding enum literals. Colour must
    // route through variantColorVar(verdictVariant(verdict)) instead.
    const rootDir = path.resolve(__dirname, "../../");
    const content = stripComments(
      fs.readFileSync(path.join(rootDir, "src/app/dashboard/page.tsx"), "utf-8"),
    );
    expect(content).not.toMatch(/verdict\s*===\s*["']GREEN["']/);
    expect(content).not.toMatch(/verdict\s*===\s*["']YELLOW["']/);
    expect(content).not.toMatch(/verdict\s*===\s*["']RED["']/);
    expect(content).toContain("variantColorVar");
  });
});

describe("Guardrail #2: Cases workspace filters source from health endpoint", () => {
  it("Cases workspace sources filter values from health endpoint (not hardcoded)", () => {
    // ADR-041 P4 — `/cases/page.tsx` is the canonical queue surface
    // now. `/exceptions/page.tsx` + `ExceptionListPane.tsx` were
    // deleted. The Guardrail #2 contract — no hardcoded intent enum
    // values in filter chips / dropdowns — moves with the route.
    const rootDir = path.resolve(__dirname, "../../");
    const pagePath = path.join(rootDir, "src/app/cases/page.tsx");
    const pageContent = stripComments(fs.readFileSync(pagePath, "utf-8"));

    // The page orchestrator must import useHealth (NavBar agent count,
    // status / intent vocabulary all come from health).
    expect(pageContent).toContain("useHealth");

    // The page should never hardcode intent option values.
    for (const intent of INTENT_LITERALS) {
      expect(pageContent).not.toMatch(new RegExp(`<option[^>]*value=["']${intent}["']`));
    }
  });
});
