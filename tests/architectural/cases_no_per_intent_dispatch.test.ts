/**
 * Architectural fitness test: /cases must NOT dispatch on intent
 * literals or any per-intent string. Guardrail #1 binding for
 * Phase H.6 (ADR-038 §6.1).
 *
 * Allowed:
 *   - case.source / case.status — these are case-level vocabularies
 *     sourced from src/types/cases.ts and ALLOWED_CASE_SOURCES in
 *     src/lib/api.ts (the boundary layer, NOT page code).
 *   - Visual mapping objects keyed on source / status, with a
 *     `default` fallback and no behavioural branches.
 *
 * Forbidden in /cases pages + CaseDetailPanel:
 *   - `if (intent === "DUPLICATE_PO")` and similar runtime branches
 *   - `<option value="DUPLICATE_PO">` hardcoded option literals
 *   - switch statements on Intent values
 *
 * The lock targets only the case surface; the existing /exceptions
 * surface is governed by its own lock tests (architectural/
 * email_order_entry_section_data_presence.test.ts etc.).
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(__dirname, "../../");
const CASES_DIR = path.join(ROOT, "src/app/cases");

// Per-intent strings that must NEVER appear as runtime literals in
// /cases pages or CaseDetailPanel. The exceptions module owns its own
// data-presence dispatch; the cases module must not duplicate it.
const FORBIDDEN_INTENT_LITERALS = [
  "DUPLICATE_PO",
  "PRICE_HOLD_RELEASE",
  "EDI_MISMATCH",
  "BACK_ORDER",
  "OVER_MAX",
  "MIN_ORDER_QTY",
  "PALLET_CONFIG",
  "DELIVERY_DELAY",
  "CONTRACTUAL_CORRECTION",
  "CREDIT_BLOCK",
  "MASS_PRICING_ERROR",
  "MANUAL_ORDER_INTAKE",
];

function findFiles(dir: string, exts: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (exts.some((e) => ent.name.endsWith(e))) out.push(full);
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("architectural: /cases has no per-intent dispatch", () => {
  it("CASES_DIR exists", () => {
    expect(fs.existsSync(CASES_DIR)).toBe(true);
  });

  it("no .tsx file under /cases contains intent === 'X' branches", () => {
    const files = findFiles(CASES_DIR, [".tsx", ".ts"]);
    expect(files.length).toBeGreaterThan(0);

    const offenders: { file: string; literal: string; pattern: string }[] = [];
    for (const file of files) {
      const src = stripComments(fs.readFileSync(file, "utf-8"));
      for (const literal of FORBIDDEN_INTENT_LITERALS) {
        // Look for runtime branches: equality checks, switch cases,
        // and JSX option-value literals.
        const equalityRe = new RegExp(
          `\\bintent\\s*[!=]==\\s*[\"']${literal}[\"']`,
          "g",
        );
        if (equalityRe.test(src)) {
          offenders.push({ file, literal, pattern: "intent === literal" });
        }

        const caseRe = new RegExp(
          `\\bcase\\s+[\"']${literal}[\"']\\s*:`,
          "g",
        );
        if (caseRe.test(src)) {
          offenders.push({ file, literal, pattern: "switch case literal" });
        }

        const optionRe = new RegExp(
          `<option[^>]*value=[\"']${literal}[\"']`,
          "g",
        );
        if (optionRe.test(src)) {
          offenders.push({ file, literal, pattern: "<option value=...>" });
        }
      }
    }

    expect(
      offenders,
      `Per-intent dispatch found in /cases — these must move to data-presence:\n${JSON.stringify(
        offenders,
        null,
        2,
      )}`,
    ).toEqual([]);
  });

  it("CaseDetailPanel mounts via the case-level surface (not intent dispatch)", () => {
    const detail = fs.readFileSync(
      path.join(CASES_DIR, "CaseDetailPanel.tsx"),
      "utf-8",
    );
    // The panel takes an OrderCase prop; if it ever started branching
    // on intent strings, the FORBIDDEN_INTENT_LITERALS check above
    // would catch it. Here we positively assert the data-presence
    // posture: the panel reads `orderCase.<field>` and uses
    // <EvidenceBlock> for audit-bearing rendering.
    expect(detail).toMatch(/orderCase\./);
    expect(detail).toMatch(/EvidenceBlock/);
  });
});
