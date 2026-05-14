/**
 * UX / screen-clutter source invariants (L0).
 *
 * docs/test-strategy/UX_ACCESSIBILITY.md Gap D. These are
 * source-grep checks — cheap, deterministic, no DOM. They catch
 * the "designs degrade by accretion" class of bug:
 *
 *   - raw z-index integers bypassing the named token ladder
 *   - landmark / skip-link plumbing rotting silently
 *   - StatusAnnouncer disconnecting from the providers root
 *   - ribbon CTA budget drifting past the design system rule
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  AUTHENTICATED_ROUTES,
  type AuthenticatedRoute,
} from "../../e2e/contract/authenticated-routes";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC = join(REPO_ROOT, "src");

function walk(dir: string, suffixes: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      out.push(...walk(p, suffixes));
    } else if (suffixes.some((sfx) => entry.endsWith(sfx))) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Strip block + line comments so a `z-index: 9999` in a comment
 * doesn't cause a false positive. Naive but sufficient for the
 * structured CSS / TS sources we own.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("UX clutter invariants — z-index discipline", () => {
  // Allowed: var(--z-...), the Tailwind shortcuts (z-modal/z-dropdown/etc.)
  // which resolve to the same tokens, and the Tailwind `z-0` / `z-10` ...
  // primitives — but NOT a four-digit literal like 9999. We forbid raw
  // literal integers in `z-index:` declarations and in inline `zIndex:`
  // properties.
  // Match the forbidden pattern positively (a literal numeric
  // value at the `z-index:` declaration site) rather than using
  // a negative lookahead for the legal forms. The lookahead
  // approach backtracks through `\s*` matching zero characters,
  // which produces false positives on legal `z-index: var(...)`.
  const cssOffenderRe = /z-index\s*:\s*-?\d/i;
  const tsxOffenderRe = /zIndex\s*:\s*['"]?-?\d/;

  function offendersInFile(path: string): string[] {
    const src = stripComments(readFileSync(path, "utf-8"));
    const lines = src.split("\n");
    const hits: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (path.endsWith(".css") && cssOffenderRe.test(line)) {
        hits.push(`${path}:${i + 1}: ${line.trim()}`);
      } else if (
        (path.endsWith(".tsx") || path.endsWith(".ts")) &&
        tsxOffenderRe.test(line)
      ) {
        hits.push(`${path}:${i + 1}: ${line.trim()}`);
      }
    }
    return hits;
  }

  it("no .tsx/.ts file outside design-tokens.css uses a raw zIndex integer", () => {
    const files = walk(SRC, [".tsx", ".ts"]);
    const violations: string[] = [];
    for (const f of files) violations.push(...offendersInFile(f));
    expect(
      violations,
      `Use \`var(--z-...)\` from design-tokens.css.\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("no .css file outside design-tokens.css declares a raw z-index integer", () => {
    const files = walk(SRC, [".css"]).filter(
      (f) => !f.endsWith("design-tokens.css"),
    );
    const violations: string[] = [];
    for (const f of files) violations.push(...offendersInFile(f));
    expect(
      violations,
      `Move z-index into design-tokens.css.\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("design-tokens.css declares the full named z-index ladder", () => {
    const tokens = readFileSync(
      join(SRC, "styles", "design-tokens.css"),
      "utf-8",
    );
    for (const t of [
      "--z-base",
      "--z-dropdown",
      "--z-sticky",
      "--z-sidebar",
      "--z-modal",
      "--z-toast",
      "--z-tooltip",
    ]) {
      expect(tokens).toMatch(new RegExp(`${t}\\s*:`));
    }
  });
});

describe("UX clutter invariants — landmark + skip-link plumbing", () => {
  it("root layout mounts a skip-to-main link", () => {
    const layout = readFileSync(
      join(SRC, "app", "layout.tsx"),
      "utf-8",
    );
    expect(layout).toMatch(/href=["']#main-content["']/);
    expect(layout).toMatch(/skip-to-main/);
  });

  it("skip-to-main styling exists in globals.css and unhides on focus", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf-8");
    expect(css).toMatch(/\.skip-to-main\s*{/);
    expect(css).toMatch(/\.skip-to-main:focus/);
  });

  // The skip link's anchor is `#main-content`. Every authenticated
  // page is the operator's primary landing surface — they must each
  // have a focusable landmark with that id so the skip link
  // actually skips chrome on every page.
  for (const route of AUTHENTICATED_ROUTES as readonly AuthenticatedRoute[]) {
    it(`authenticated route ${route.path} renders id="main-content"`, () => {
      const src = readFileSync(join(REPO_ROOT, route.source), "utf-8");
      const stripped = stripComments(src);
      // Match `id="main-content"` regardless of element. Some pages
      // host the landmark on a wrapper rather than <main> (e.g. /home
      // is a multi-section dashboard); a single matching id is enough
      // to satisfy the skip link.
      expect(
        stripped,
        `${route.source}: expected an element with id="main-content"`,
      ).toMatch(/id=["']main-content["']/);
    });
  }
});

describe("UX clutter invariants — StatusAnnouncer is mounted at root", () => {
  it("providers.tsx wraps children in <StatusAnnouncer>", () => {
    const src = readFileSync(
      join(SRC, "app", "providers.tsx"),
      "utf-8",
    );
    expect(src).toMatch(/import\s*{\s*StatusAnnouncer\s*}/);
    expect(src).toMatch(/<StatusAnnouncer/);
  });

  it("root layout uses <Providers>", () => {
    const src = readFileSync(join(SRC, "app", "layout.tsx"), "utf-8");
    expect(src).toMatch(/<Providers/);
  });
});

describe("UX clutter invariants — primary CTA budget", () => {
  // AgentReasoningCard hosts the primary action row on every
  // exception-detail surface (the verdict × permission button
  // matrix documented at the top of the file). The design system
  // caps "primary" actions per surface at 3 — a fourth primary
  // CTA produces the button-soup anti-pattern Maya flagged. The
  // cap is encoded as an exported constant so it is visible in
  // source review and source-grep-lockable here.
  const cardPath = join(
    SRC,
    "components",
    "ui",
    "AgentReasoningCard.tsx",
  );

  it("AgentReasoningCard exports MAX_PRIMARY_ACTIONS and it is ≤ 3", () => {
    const src = readFileSync(cardPath, "utf-8");
    const match = src.match(
      /export\s+const\s+MAX_PRIMARY_ACTIONS\s*(?::\s*number)?\s*=\s*(\d+)/,
    );
    expect(
      match,
      "AgentReasoningCard must export `MAX_PRIMARY_ACTIONS` so the cap " +
        "is visible in source review and source-grep-lockable here. " +
        "Add `export const MAX_PRIMARY_ACTIONS = 3;` at module scope.",
    ).not.toBeNull();
    if (match) {
      expect(Number(match[1])).toBeLessThanOrEqual(3);
      expect(Number(match[1])).toBeGreaterThanOrEqual(1);
    }
  });
});
