/**
 * Architectural Fitness Test: EmailSourceSection mounts via data-presence
 * dispatch only (ADR-034 Phase G, PO-driven IA correction).
 *
 * Asserts:
 *   1. ExceptionDetailPanel mounts EmailSourceSection only inside the
 *      `analysis?.email_source &&` data-presence guard.
 *   2. EmailSourceSection mounts ABOVE EmailOrderEntrySection in the
 *      detail panel — the IA decision is that the source-of-truth is
 *      the operator's first frame of reference, the recommendation
 *      sits below it.
 *   3. No file under `src/app/` does runtime dispatch on
 *      `intent === "EMAIL_ORDER_ENTRY"` for mounting the source
 *      section (CLAUDE.md Guardrail #1 — adding/removing the intent
 *      requires zero UI page-level changes).
 *   4. Section import wired exactly once in ExceptionDetailPanel.
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

describe("EmailSourceSection — data-presence dispatch lock (ADR-034 Phase G)", () => {
  const detailPanelPath = path.join(
    ROOT,
    "src/app/exceptions/ExceptionDetailPanel.tsx",
  );

  it("ExceptionDetailPanel mounts the source section via analysis.email_source &&", () => {
    const content = stripComments(fs.readFileSync(detailPanelPath, "utf-8"));
    expect(content).toMatch(/analysis\??\.email_source\s*&&/);
    expect(content).toMatch(/<EmailSourceSection\b/);
  });

  it("source section mounts ABOVE the recommendation section (operator sees source first)", () => {
    const content = stripComments(fs.readFileSync(detailPanelPath, "utf-8"));
    const sourceIdx = content.indexOf("<EmailSourceSection");
    const recoIdx = content.indexOf("<EmailOrderEntrySection");
    expect(sourceIdx).toBeGreaterThan(-1);
    expect(recoIdx).toBeGreaterThan(-1);
    expect(sourceIdx).toBeLessThan(recoIdx);
  });

  it("no file under src/app/ dispatches on intent literal to mount the source section", () => {
    // Walk src/app/ and confirm the source section is never wrapped in
    // intent === / case "EMAIL_ORDER_ENTRY" branches. Mounting must be
    // data-presence-only (Guardrail #1).
    function walk(dir: string): string[] {
      if (!fs.existsSync(dir)) return [];
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))
          out.push(full);
      }
      return out;
    }

    const offenders: string[] = [];
    for (const file of walk(path.join(ROOT, "src/app"))) {
      const content = stripComments(fs.readFileSync(file, "utf-8"));
      if (!content.includes("EmailSourceSection")) continue;
      // The ONLY allowed pattern is import + <EmailSourceSection ... />
      // inside `analysis?.email_source &&`. Reject any intent-keyed
      // dispatch nearby.
      if (/intent\s*[!=]==\s*["']EMAIL_ORDER_ENTRY["']/.test(content)) {
        offenders.push(
          `${path.relative(ROOT, file)}: equality check on EMAIL_ORDER_ENTRY ` +
            "near the source section",
        );
      }
      if (/case\s+["']EMAIL_ORDER_ENTRY["']\s*:/.test(content)) {
        offenders.push(
          `${path.relative(ROOT, file)}: switch case on EMAIL_ORDER_ENTRY ` +
            "near the source section",
        );
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("section import wired exactly once in ExceptionDetailPanel", () => {
    const content = fs.readFileSync(detailPanelPath, "utf-8");
    const importMatches = content.match(
      /import\s+\{\s*EmailSourceSection\s*\}\s+from\s+["'][^"']+["']/g,
    );
    expect(importMatches).not.toBeNull();
    expect(importMatches!.length).toBe(1);
  });
});
