/**
 * DoR #10 (XSS) source lock — no `dangerouslySetInnerHTML` in the app.
 *
 * Email bodies, EDI segments, reply drafts, and SAP strings are
 * backend-provided free text rendered into SOX-relevant operator surfaces. As
 * long as everything flows through JSX text nodes, React auto-escapes and there
 * is no XSS sink. `dangerouslySetInnerHTML` is the one escape hatch that breaks
 * that guarantee — this lock fails the build the moment it appears under src/,
 * forcing a deliberate, reviewed exception (add an allowlist entry with a
 * sanitiser) rather than a silent hole.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const SRC = join(__dirname, "..", "..", "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("no dangerouslySetInnerHTML (DoR #10 XSS)", () => {
  it("is absent across the entire src/ tree", () => {
    const offenders = walk(SRC).filter((f) =>
      readFileSync(f, "utf-8").includes("dangerouslySetInnerHTML"),
    );
    expect(offenders).toEqual([]);
  });
});
