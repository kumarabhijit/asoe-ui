/**
 * CP-B RED gate (ADR-043 §2.5, decision D6) — preview wiring keeps the section a
 * dumb projector. `case_id` is threaded as an EXPLICIT prop (not React context —
 * data provenance must be visible on a SOX surface), and the section never
 * fetches bytes itself: bytes are read via `src/lib/api.ts` at the page level
 * (CLAUDE.md engineering rule + Guardrail #6), and the iframe points at the
 * RBAC-gated endpoint.
 *
 * Written test-first; `it.fails` (vitest xfail-strict analog) is green while the
 * `caseId` prop is pending at CP-D, and turns red — forcing marker removal — the
 * moment the prop is threaded. Source-grep only, so `tsc --noEmit` stays clean.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const SECTION = path.resolve(
  __dirname,
  "../..",
  "src/app/exceptions/EmailSourceSection.tsx",
);

function stripComments(content: string): string {
  return content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("EmailSourceSection preview wiring (ADR-043)", () => {
  it("section receives caseId explicitly and never fetches bytes directly", () => {
    const src = stripComments(readFileSync(SECTION, "utf-8"));

    // Threaded explicitly from ExceptionDetailPanel — pending until CP-D.
    expect(src, "EmailSourceSection must accept a caseId prop").toMatch(/caseId\s*[?:]/);

    // Dumb projector: no direct data access in the section.
    expect(src, "section must not import the API client").not.toMatch(
      /from\s+["']@\/lib\/api["']/,
    );
    expect(src, "section must not call fetch() directly").not.toMatch(/\bfetch\s*\(/);
  });
});
