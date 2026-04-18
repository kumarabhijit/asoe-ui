/**
 * Architectural Fitness Test: Dark-mode token parity.
 *
 * Parses src/styles/design-tokens.css and asserts that every color
 * token defined under :root has a corresponding override under .dark.
 * Without this, a new color token added to :root would silently leak
 * the light value into dark mode.
 *
 * Non-color tokens (spacing, radius, motion, layout) are intentionally
 * shared between light and dark — they are not checked.
 */
import * as fs from "fs";
import * as path from "path";

const TOKENS_PATH = path.resolve(__dirname, "../../src/styles/design-tokens.css");

/**
 * Extract the body of a CSS rule block (everything inside the outermost
 * matching braces). Returns null if the selector is not found.
 */
function extractBlock(css: string, selector: string): string | null {
  const selectorIndex = css.indexOf(selector);
  if (selectorIndex === -1) return null;

  const openBrace = css.indexOf("{", selectorIndex);
  if (openBrace === -1) return null;

  let depth = 1;
  let i = openBrace + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  if (depth !== 0) return null;

  return css.slice(openBrace + 1, i - 1);
}

/** Return the set of CSS custom-property names defined in the block. */
function extractCustomPropertyNames(block: string): Set<string> {
  const names = new Set<string>();
  const re = /(--[a-z0-9-]+)\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    names.add(m[1]);
  }
  return names;
}

describe("Dark-mode token parity", () => {
  const css = fs.readFileSync(TOKENS_PATH, "utf-8");
  const rootBlock = extractBlock(css, ":root");
  const darkBlock = extractBlock(css, ".dark");

  it("design-tokens.css defines :root", () => {
    expect(rootBlock).not.toBeNull();
  });

  it("design-tokens.css defines .dark", () => {
    expect(darkBlock).not.toBeNull();
  });

  it("every --color-* token in :root has a .dark counterpart", () => {
    const rootTokens = extractCustomPropertyNames(rootBlock!);
    const darkTokens = extractCustomPropertyNames(darkBlock!);

    const rootColorTokens = [...rootTokens].filter((n) => n.startsWith("--color-"));
    const missing = rootColorTokens.filter((n) => !darkTokens.has(n));

    expect(
      missing,
      `The following :root color tokens have no .dark override. Either ` +
        `add a .dark { ${missing.join("; ")}; } block or remove them from :root: ${missing.join(
          ", ",
        )}`,
    ).toEqual([]);
  });

  it("every --shadow-* token in :root has a .dark counterpart", () => {
    const rootTokens = extractCustomPropertyNames(rootBlock!);
    const darkTokens = extractCustomPropertyNames(darkBlock!);

    const rootShadowTokens = [...rootTokens].filter((n) => n.startsWith("--shadow-"));
    const missing = rootShadowTokens.filter((n) => !darkTokens.has(n));

    expect(
      missing,
      `Shadows need dark-mode reweighting. Missing: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it(".dark does not introduce tokens absent from :root", () => {
    const rootTokens = extractCustomPropertyNames(rootBlock!);
    const darkTokens = extractCustomPropertyNames(darkBlock!);

    const darkOnly = [...darkTokens].filter((n) => !rootTokens.has(n));

    expect(
      darkOnly,
      `:root must be the union of all tokens so IDEs / TypeScript tooling can discover them. ` +
        `Dark-only tokens: ${darkOnly.join(", ")}`,
    ).toEqual([]);
  });
});
