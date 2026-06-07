/**
 * Architectural Fitness Test: Tailwind classes must resolve to a design token.
 *
 * Remediation batch 1 (UX audit theme T8). Classes that name a token/utility
 * that does not exist render the element silently UNSTYLED (or fall back to
 * Tailwind's default rem scale, which bypasses `design-tokens.css`). These are
 * invisible in code review and only surface at runtime. This guard fails the
 * build when such a class reappears.
 *
 * Three failure modes observed in the audit, each anchored to a real finding:
 *   1. Spacing utilities with a numeric step NOT in the project scale
 *      (`pl-30`, `px-14`) — EventsTimeline.tsx:250, ExceptionDetailPanel, etc.
 *      The valid scale is derived from `--space-*` in design-tokens.css so the
 *      guard stays in sync with the token source of truth.
 *   2. `text-<font-size-alias>` using a Tailwind default size token
 *      (`text-h4`, `text-h2`, `text-sm`) — the project type scale is named
 *      (display/title/heading/subhead/body/caption/label), so any default-size
 *      alias is a silent no-font-size bug. error.tsx x4, 403/page.tsx.
 *   3. The `-status-` colour pseudo-namespace (`text-status-error`) which is
 *      not a colour root in tailwind.config.ts — ErasureCertificateButton,
 *      OrderEntrySection, DraftReplySection.
 *
 * The scan runs over raw file text so it catches the class regardless of how
 * the className is assembled (string literal, template literal, cn(), cva()).
 */

import * as fs from "fs";
import * as path from "path";

const rootDir = path.resolve(__dirname, "../../");
const SCAN_DIRS = ["src"];

function findFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

/** Valid spacing steps, derived from `--space-N` in design-tokens.css. */
function validSpacingSteps(): Set<string> {
  const css = fs.readFileSync(
    path.join(rootDir, "src/styles/design-tokens.css"),
    "utf-8",
  );
  const steps = new Set<string>();
  for (const m of css.matchAll(/--space-(\d+)\s*:/g)) {
    steps.add(m[1]);
  }
  return steps;
}

const SPACING = validSpacingSteps();

// Padding / margin / gap / space utilities — the spacing-token family.
const SPACING_CLASS = /\b(p[lrtbxy]?|m[lrtbxy]?|gap(?:-[xy])?|space-[xy])-(\d+)\b/g;

// Tailwind default font-size aliases the project type scale does NOT define.
const FONT_ALIAS_CLASS = /\btext-(h[1-6]|xs|sm|base|lg|xl|[2-9]xl)\b/g;

// `-status-` is not a colour root in tailwind.config.ts.
const STATUS_NAMESPACE_CLASS =
  /\b(?:text|bg|border|fill|stroke|ring|divide|outline)-status-[a-z]+\b/g;

const files = findFiles(path.join(rootDir, SCAN_DIRS[0]), [".tsx", ".ts"]);

describe("design tokens: spacing steps are sourced from design-tokens.css", () => {
  it("derives a non-empty scale (sanity)", () => {
    expect(SPACING.size).toBeGreaterThan(5);
    expect(SPACING.has("16")).toBe(true);
    expect(SPACING.has("30")).toBe(false);
  });
});

describe("Tailwind class → token resolution guard", () => {
  for (const file of files) {
    const rel = path.relative(rootDir, file);

    it(`${rel} uses only resolvable spacing / font-size / colour classes`, () => {
      const content = fs.readFileSync(file, "utf-8");
      const violations: string[] = [];

      for (const m of content.matchAll(SPACING_CLASS)) {
        if (!SPACING.has(m[2])) violations.push(m[0]);
      }
      for (const m of content.matchAll(FONT_ALIAS_CLASS)) {
        violations.push(m[0]);
      }
      for (const m of content.matchAll(STATUS_NAMESPACE_CLASS)) {
        violations.push(m[0]);
      }

      expect(
        violations,
        `Unresolvable Tailwind classes in ${rel}: ${[...new Set(violations)].join(", ")}. ` +
          `Spacing must use a --space-* step; font sizes the named scale ` +
          `(text-heading/title/…); colours a real root (text-error, not text-status-error).`,
      ).toEqual([]);
    });
  }
});
