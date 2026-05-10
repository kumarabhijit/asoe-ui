// Lint guard: surface JSDoc shapes that trip vite-4's oxc transformer.
//
// Empirically reproduced trap: the literal sequence "**/" appearing
// inside a /** ... */ comment closes the comment at that point under
// vite:oxc, even though tsc / prettier / the LSP all parse it
// correctly. The remaining prose then parses as code and CI explodes
// with "Expected a semicolon".
//
// The pattern is easy to introduce by accident — globs like
// src/app/**\/page.tsx and Markdown-style code fences inside JSDoc
// both trigger it. AI-generated code reproduces it by default
// because every other tool accepts the input. This guard is the
// only place in CI that fails when it reappears.
//
// What this guard does NOT check:
//   - Backticks inside JSDoc. Empirically not a trap; the existing
//     codebase has hundreds of legitimate uses (`*Section.tsx`,
//     `useHealth`, etc.) and they parse fine.
//   - Single quotes / em-dashes inside JSDoc. Also not a trap.
//
// If a new oxc-specific failure surfaces, add the pattern here
// rather than relaxing the existing rule.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

// Directories that are checked. Keep this tight — generated
// fixtures and node_modules must not be scanned.
const SCAN_DIRS = ["src", "e2e", "tests"] as const;

// Files we never scan. The lint file itself is excluded because
// any string literal containing the trap pattern would be a false
// positive (we're describing the pattern in code).
const SKIP_FILE_PATTERNS = [
  /\.expected\.spec\.ts$/, // codegen golden snapshots
  /\.snap$/,
  /jsdoc_parser_traps\.test\.ts$/,
];

interface Violation {
  file: string;
  line: number;
  excerpt: string;
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (
        (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
        !SKIP_FILE_PATTERNS.some((p) => p.test(entry))
      )
        out.push(full);
    }
  }
  walk(root);
  return out;
}

// Find every /** ... */ block. Emit each block's body content
// (without the opener and terminator) plus the line number where
// the body starts.
//
// The terminator we look for is "*/ " preceded by something OTHER
// than "*". A "*/" that is part of "**/" is intentionally walked
// past — that is the trap we want to detect, not the real
// terminator. tsc / prettier / the LSP all walk past "**/" the
// same way; only vite:oxc closes at it.
function* findJSDocBlocks(
  source: string,
): Generator<{ startLine: number; body: string }> {
  let i = 0;
  let line = 1;
  while (i < source.length) {
    if (
      source[i] === "/" &&
      source[i + 1] === "*" &&
      source[i + 2] === "*" &&
      source[i + 3] !== "/"
    ) {
      i += 3;
      const bodyStart = i;
      const bodyStartLine = line;
      while (i < source.length) {
        // Real terminator: "*/" not preceded by "*". The "**/"
        // sequence is the trap, not the close.
        if (
          source[i] === "*" &&
          source[i + 1] === "/" &&
          source[i - 1] !== "*"
        ) {
          yield {
            startLine: bodyStartLine,
            body: source.slice(bodyStart, i),
          };
          i += 2;
          break;
        }
        if (source[i] === "\n") line++;
        i++;
      }
    } else {
      if (source[i] === "\n") line++;
      i++;
    }
  }
}

function scanFile(absPath: string): Violation[] {
  const violations: Violation[] = [];
  const source = readFileSync(absPath, "utf-8");
  const rel = relative(REPO_ROOT, absPath);
  for (const block of findJSDocBlocks(source)) {
    const lines = block.body.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("**/")) {
        violations.push({
          file: rel,
          line: block.startLine + i,
          excerpt: lines[i].trim(),
        });
      }
    }
  }
  return violations;
}

describe("jsdoc-parser-traps lint", () => {
  const allFiles = SCAN_DIRS.flatMap((d) => listFiles(join(REPO_ROOT, d)));

  it("scans at least 50 files (sanity)", () => {
    // Locks the lint against being silently neutered by a future
    // refactor of SCAN_DIRS.
    expect(allFiles.length).toBeGreaterThan(50);
  });

  it('no "**/" sequences inside /** ... */ blocks', () => {
    const violations = allFiles.flatMap(scanFile);
    if (violations.length > 0) {
      const formatted = violations
        .slice(0, 10)
        .map((v) => `  ${v.file}:${v.line} -> ${v.excerpt}`)
        .join("\n");
      throw new Error(
        '"**/" inside a JSDoc block (typically a glob like src/app/**/page.tsx) ' +
          "is parsed by vite-4 oxc as the comment terminator and breaks the build. " +
          "Use a // line comment for that block, or write the glob without the " +
          'consecutive "**" sequence.\n' +
          `Found ${violations.length} occurrence(s):\n${formatted}`,
      );
    }
  });

  it("self-check: scanner detects the trap in a synthetic input", () => {
    // Build the synthetic source via concatenation so this file
    // itself doesn't contain the pattern (and isn't skipped only
    // because of the SKIP_FILE_PATTERNS exception).
    const star = "*";
    const synthetic =
      "/" + star + star + "\n" +
      " " + star + " src/app/" + star + star + "/page.tsx\n" +
      " " + star + "/\n" +
      "export const x = 1;\n";

    const blocks = Array.from(findJSDocBlocks(synthetic));
    expect(blocks.length).toBe(1);
    const hasTrap = blocks[0].body
      .split("\n")
      .some((l) => l.includes(star + star + "/"));
    expect(hasTrap).toBe(true);
  });

  it("self-check: scanner ignores the same pattern in a // line comment", () => {
    const star = "*";
    const synthetic =
      "// src/app/" + star + star + "/page.tsx scanner test\n" +
      "export const x = 1;\n";
    const blocks = Array.from(findJSDocBlocks(synthetic));
    expect(blocks.length).toBe(0);
  });
});
