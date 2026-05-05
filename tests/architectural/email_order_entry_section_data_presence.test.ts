/**
 * Architectural Fitness Test: EmailOrderEntrySection mounts via
 * data-presence dispatch only (ADR-034 §6 IA decision).
 *
 * The IA decision recorded in `asoe2/docs/adr/ADR-034-email-order-entry-skill.md`
 * §6 commits us to NOT introducing intent-keyed page-level dispatch
 * for EMAIL_ORDER_ENTRY. The section mounts when the backend's
 * `OrderAnalysis.email_order_entry_analysis` is populated, exactly the
 * same way every other enrichment section mounts (data-presence
 * pattern). This is a CLAUDE.md Guardrail #1 lock — adding or removing
 * the EMAIL_ORDER_ENTRY intent in asoe2 must require zero UI page-level
 * changes.
 *
 * Asserts:
 *   1. ExceptionDetailPanel mounts EmailOrderEntrySection only inside
 *      `analysis?.email_order_entry_analysis &&` data-presence guard —
 *      no `intent === "EMAIL_ORDER_ENTRY"` dispatch.
 *   2. No file under `src/app/` contains a hard string-literal check
 *      against `"EMAIL_ORDER_ENTRY"` (e.g. `intent === "EMAIL_ORDER_ENTRY"`,
 *      `<option value="EMAIL_ORDER_ENTRY">`, `case "EMAIL_ORDER_ENTRY":`).
 *      Type definitions in `src/types/` are exempt — those are
 *      compile-time safety, not runtime dispatch (CLAUDE.md Guardrail #1).
 *   3. The intent literal does appear in `MOCK_HEALTH.allowed_intents`
 *      (config) and the `EmailOrderEntrySection` import wiring; both
 *      are explicitly allowed.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(__dirname, "../../");

function stripComments(content: string): string {
  let stripped = content.replace(/\/\/.*$/gm, "");
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, "");
  return stripped;
}

function findTsxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsxFiles(full));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}


describe("EmailOrderEntrySection — data-presence dispatch lock (ADR-034 §6)", () => {
  it("ExceptionDetailPanel mounts the section via analysis.email_order_entry_analysis &&", () => {
    const file = path.join(ROOT, "src/app/exceptions/ExceptionDetailPanel.tsx");
    const content = stripComments(fs.readFileSync(file, "utf-8"));

    // The mount line uses the data-presence guard, identical to the
    // other enrichment sections. We require both: the conditional
    // mount AND the JSX usage of <EmailOrderEntrySection ... />.
    expect(content).toMatch(/analysis\??\.email_order_entry_analysis\s*&&/);
    expect(content).toMatch(/<EmailOrderEntrySection\b/);

    // Exclude any intent-keyed dispatch for the EmailOrderEntry intent.
    expect(content).not.toMatch(
      /intent\s*===\s*["']EMAIL_ORDER_ENTRY["']/,
    );
    expect(content).not.toMatch(
      /case\s+["']EMAIL_ORDER_ENTRY["']\s*:/,
    );
  });

  it("no .tsx/.ts file under src/app/ does runtime dispatch on the EMAIL_ORDER_ENTRY literal", () => {
    const files = findTsxFiles(path.join(ROOT, "src/app"));
    const offenders: string[] = [];

    for (const file of files) {
      const content = stripComments(fs.readFileSync(file, "utf-8"));
      // intent === "EMAIL_ORDER_ENTRY" — page-level conditional.
      if (/intent\s*[!=]==\s*["']EMAIL_ORDER_ENTRY["']/.test(content)) {
        offenders.push(`${path.relative(ROOT, file)}: equality check on intent literal`);
      }
      // switch (intent) { case "EMAIL_ORDER_ENTRY": } — switch dispatch.
      if (/case\s+["']EMAIL_ORDER_ENTRY["']\s*:/.test(content)) {
        offenders.push(`${path.relative(ROOT, file)}: switch case on intent literal`);
      }
      // <option value="EMAIL_ORDER_ENTRY"> — hardcoded filter option.
      if (/<option[^>]*value=["']EMAIL_ORDER_ENTRY["']/.test(content)) {
        offenders.push(`${path.relative(ROOT, file)}: hardcoded <option> for the intent`);
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the only allowed places that name the literal are the config layer + section import wiring", () => {
    // The intent literal is allowed to appear at the configuration
    // boundary — `src/lib/api.ts` MOCK_HEALTH (the Guardrail #2 source
    // of runtime values), `src/config/erp-label-map.ts`, and the
    // section/component import wiring in ExceptionDetailPanel. Confirm
    // the locations the lock test EXPECTS to find it actually do —
    // catches accidental deletion of the intent from the config surface.
    const apiPath = path.join(ROOT, "src/lib/api.ts");
    const labelMapPath = path.join(ROOT, "src/config/erp-label-map.ts");

    const apiContent = fs.readFileSync(apiPath, "utf-8");
    const labelMapContent = fs.readFileSync(labelMapPath, "utf-8");

    expect(apiContent).toContain('"EMAIL_ORDER_ENTRY"');
    expect(labelMapContent).toContain("EMAIL_ORDER_ENTRY:");
  });

  it("the section import is wired in ExceptionDetailPanel exactly once", () => {
    const file = path.join(ROOT, "src/app/exceptions/ExceptionDetailPanel.tsx");
    const content = fs.readFileSync(file, "utf-8");
    const importMatches = content.match(
      /import\s+\{\s*EmailOrderEntrySection\s*\}\s+from\s+["'][^"']+["']/g,
    );
    expect(importMatches).not.toBeNull();
    expect(importMatches!.length).toBe(1);
  });
});
