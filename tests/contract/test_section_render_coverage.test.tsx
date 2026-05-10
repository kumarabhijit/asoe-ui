/**
 * Spec-as-oracle: every audit-bearing `*AnalysisData` interface in
 * `src/types/exceptions.ts` is rendered by at least one section
 * component in `src/app/exceptions/`.
 *
 * Per design.md Lane 2 Week 6 + Eng Review Decision D5:
 *   "Each `*Section.tsx` exports `export const RENDERS = ['BackOrderAnalysisData'];`
 *    The W6 test imports every section, collects the `RENDERS` arrays,
 *    and asserts every audit-bearing class is covered."
 *
 * V1 implementation: until every section ships its `RENDERS` export,
 * this test discovers section components by filesystem scan and reads
 * the `data: <Type>` prop annotation as a fallback. Adding the explicit
 * `RENDERS` export per D5 is a per-section cleanup pass — when it
 * lands, this test prefers the export over the regex fallback.
 *
 * Catches the cross-cutting class of bug where asoe2 ships a new
 * `*AnalysisData` interface (composer projects it from a recipe) but
 * no asoe-ui section exists to render it — the user sees a missing
 * panel and the operator can't audit the field.
 *
 * Reference: docs/test-strategy/eng-review-test-plan.md (Critical Paths
 * — "Every audit-bearing field has a render path").
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SECTIONS_DIR = join(__dirname, "..", "..", "src", "app", "exceptions");
const TYPES_PATH = join(__dirname, "..", "..", "src", "types", "exceptions.ts");

/**
 * Audit-bearing interfaces that the UI MUST render. The list mirrors
 * the `OrderAnalysis` field declarations in `src/types/exceptions.ts`
 * lines ~340–370. A new `*AnalysisData` interface that's wired into
 * `OrderAnalysis` must be added here OR rendered by a section before
 * this test passes.
 *
 * Excluded from the assertion (rendered by intent-specific composite
 * sections, not stand-alone *AnalysisData interfaces):
 *   - `DuplicateDetectionData` (rendered by `DuplicateDetectionSection.tsx`,
 *     name doesn't end in AnalysisData by historical convention).
 */
const AUDIT_BEARING_ANALYSIS_INTERFACES: readonly string[] = [
  "PriceAnalysisData",
  "BackOrderAnalysisData",
  "OverMaxAnalysisData",
  "MOQAnalysisData",
  "PalletAnalysisData",
  "DeliveryDelayAnalysisData",
  "PriceHoldAnalysisData",
  "EdiMismatchAnalysisData",
  "EmailOrderEntryAnalysisData",
] as const;

interface SectionDescriptor {
  filename: string;
  declaredRenders: string[]; // populated from `export const RENDERS = [...]`
  fallbackRenders: string[]; // populated from `data: <Type>` prop annotation
}

function scanSection(filename: string): SectionDescriptor {
  const path = join(SECTIONS_DIR, filename);
  const src = readFileSync(path, "utf-8");

  // Preferred: explicit self-describing export per D5.
  const rendersExportMatch = src.match(
    /export\s+const\s+RENDERS\s*(?::\s*[^=]+)?=\s*\[([\s\S]*?)\]/,
  );
  const declaredRenders = rendersExportMatch
    ? [...rendersExportMatch[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
    : [];

  // Fallback: scan for `data: <Type>` prop annotation in the section's
  // props interface, plus type imports of `*AnalysisData`.
  const propMatches = [
    ...src.matchAll(/\bdata\s*:\s*([A-Z][a-zA-Z0-9]*AnalysisData)\b/g),
  ].map((m) => m[1]);
  const importMatches = [
    ...src.matchAll(
      /import\s+type\s+\{[^}]*\b([A-Z][a-zA-Z0-9]*AnalysisData)\b[^}]*\}/g,
    ),
  ].map((m) => m[1]);
  const fallbackRenders = Array.from(new Set([...propMatches, ...importMatches]));

  return { filename, declaredRenders, fallbackRenders };
}

function discoverSections(): SectionDescriptor[] {
  const all = readdirSync(SECTIONS_DIR);
  return all
    .filter((f) => f.endsWith("Section.tsx"))
    .map(scanSection);
}

describe("Section render coverage (Lane 2 Week 6)", () => {
  it("every audit-bearing *AnalysisData interface has a section that renders it", () => {
    if (!existsSync(SECTIONS_DIR)) {
      throw new Error(`sections dir not found: ${SECTIONS_DIR}`);
    }
    const sections = discoverSections();
    const covered = new Set<string>();
    for (const s of sections) {
      for (const t of s.declaredRenders) covered.add(t);
      for (const t of s.fallbackRenders) covered.add(t);
    }
    const missing = AUDIT_BEARING_ANALYSIS_INTERFACES.filter(
      (t) => !covered.has(t),
    );
    expect(
      missing,
      `audit-bearing AnalysisData interfaces with no section render path: ${JSON.stringify(missing)}.\n` +
        `Add a section component under src/app/exceptions/ that imports the type and exposes ` +
        `\`export const RENDERS = ['<TypeName>'];\` per Eng Review Decision D5.`,
    ).toEqual([]);
  });

  it("no section claims to render an interface that doesn't exist", () => {
    const typesSrc = readFileSync(TYPES_PATH, "utf-8");
    const declaredInterfaces = new Set(
      [...typesSrc.matchAll(/export\s+interface\s+([A-Z][a-zA-Z0-9]*AnalysisData)\b/g)].map(
        (m) => m[1],
      ),
    );
    expect(
      declaredInterfaces.size,
      "Expected at least one *AnalysisData interface in src/types/exceptions.ts",
    ).toBeGreaterThan(0);

    const sections = discoverSections();
    const phantom: { section: string; type: string }[] = [];
    for (const s of sections) {
      for (const t of s.declaredRenders) {
        if (!declaredInterfaces.has(t)) {
          phantom.push({ section: s.filename, type: t });
        }
      }
    }
    expect(
      phantom,
      `Sections claim RENDERS for unknown types: ${JSON.stringify(phantom)}`,
    ).toEqual([]);
  });

  it("every audit-bearing AnalysisData has a wiring in ExceptionDetailPanel", () => {
    const panel = readFileSync(
      join(__dirname, "..", "..", "src", "app", "exceptions", "ExceptionDetailPanel.tsx"),
      "utf-8",
    );
    // Each AnalysisData interface corresponds to a snake_case field on
    // OrderAnalysis: `BackOrderAnalysisData` ↔ `backorder_analysis`.
    // Drive the assertion off the OrderAnalysis declaration so the
    // interface→field mapping is the single source of truth, not a
    // hard-coded list.
    const typesSrc = readFileSync(TYPES_PATH, "utf-8");
    const orderAnalysisMatch = typesSrc.match(
      /export\s+interface\s+OrderAnalysis\b[^{]*\{([\s\S]*?)\n\}/,
    );
    if (!orderAnalysisMatch) {
      throw new Error("Could not locate OrderAnalysis interface");
    }
    const fieldRows = [
      ...orderAnalysisMatch[1].matchAll(
        /^\s*([a-z_][a-z0-9_]*)\s*\??\s*:\s*([A-Z][a-zA-Z0-9]*AnalysisData)\b/gm,
      ),
    ];
    const missing: string[] = [];
    for (const row of fieldRows) {
      const [, fieldName, typeName] = row;
      if (!AUDIT_BEARING_ANALYSIS_INTERFACES.includes(typeName as never)) continue;
      // Does ExceptionDetailPanel reference `analysis.<fieldName>`?
      const re = new RegExp(String.raw`analysis\??\.${fieldName}\b`);
      if (!re.test(panel)) missing.push(`${fieldName} (${typeName})`);
    }
    expect(
      missing,
      `audit-bearing fields with no ExceptionDetailPanel render branch: ${JSON.stringify(missing)}`,
    ).toEqual([]);
  });
});
