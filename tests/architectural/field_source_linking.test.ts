/**
 * Deliverable lock (Pattern A) — ADR-043 field↔source linking.
 *
 * The verify-against-source loop spans three files coordinated by one shared
 * selection keyed on a backend-authoritative ref. Behavioural tests can't catch
 * "a side was never wired", so this lock asserts the wiring exists:
 *
 *   1. The document viewer (AttachmentPreview) consumes the shared selection
 *      and renders selectable, keyboard-operable safety-bar rows keyed by
 *      supports_ref.
 *   2. The entity section consumes the shared selection.
 *   3. The panel mounts the provider (keyed by exceptionId so a record switch
 *      drops a stale highlight).
 *   4. Mock invariant — the mock entity's evidence_ref stays in lockstep with
 *      the anchor ref the mock derives for the same entity (order_entry.${key}),
 *      so the cross-link is exercisable end-to-end in mock/dev without the UI
 *      ever deriving a pairing (Guardrail #6).
 *
 * Verify by removing any wired side locally — this must fail.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf-8");

describe("field↔source linking deliverable", () => {
  it("AttachmentPreview consumes the shared selection and renders selectable rows", () => {
    const src = read("src", "components", "ui", "AttachmentPreview.tsx");
    expect(src).toContain('from "@/hooks/useEvidenceSelection"');
    expect(src).toContain("useEvidenceSelection(");
    // Safety-bar rows are buttons with aria-pressed + the authoritative ref.
    expect(src).toContain("aria-pressed={isSelected}");
    expect(src).toContain("data-supports-ref={anchor.supports_ref}");
    // Selected overlay carries the selection marker the e2e/test asserts on.
    expect(src).toContain("data-selected={isSelected || undefined}");
  });

  it("EntitiesSection consumes the shared selection", () => {
    const src = read("src", "app", "exceptions", "EntitiesSection.tsx");
    expect(src).toContain('from "@/hooks/useEvidenceSelection"');
    expect(src).toContain("entity.evidence_ref");
  });

  it("ExceptionDetailPanel mounts the provider keyed by exceptionId", () => {
    const src = read("src", "app", "exceptions", "ExceptionDetailPanel.tsx");
    expect(src).toContain("EvidenceSelectionProvider");
    expect(src).toContain("<EvidenceSelectionProvider key={exceptionId}>");
  });

  it("mock entity evidence_ref stays in lockstep with the derived anchor ref", () => {
    const src = read("src", "lib", "mock-data", "inbox-sections.ts");
    // The anchor ref the mock derives (shared by text-derived + spatial anchors).
    expect(src).toContain("const supports_ref = `order_entry.${e.key}`");
    // Every keyed mock entity that declares evidence_ref must use the same
    // order_entry.${key} shape (no divergent vocabulary).
    const refs = [...src.matchAll(/evidence_ref:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref.startsWith("order_entry.")).toBe(true);
    }
  });
});
