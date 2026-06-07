/**
 * UX remediation Batch 6 — source locks for the shared interactive-primitive
 * fixes (report 08). Structural fixes anchored to real audit findings; each
 * fails on the parent commit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

function read(rel: string): string {
  return readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");
}

describe("Batch 6 — Button drops the redundant variant/size redeclaration", () => {
  const src = read("src/components/ui/Button.tsx");
  it("relies on VariantProps<typeof buttonVariants>, not local re-types", () => {
    expect(src).not.toMatch(/type\s+Variant\s*=/);
    expect(src).not.toMatch(/type\s+Size\s*=/);
    expect(src).not.toMatch(/variant\?:\s*Variant/);
    expect(src).toMatch(/VariantProps<typeof buttonVariants>/);
  });
});

describe("Batch 6 — Toast", () => {
  const src = read("src/components/ui/Toast.tsx");
  it("pauses the auto-dismiss timer on hover/focus (WCAG 2.2.1)", () => {
    expect(src).toMatch(/onMouseEnter=\{pause\}/);
    expect(src).toMatch(/onMouseLeave=\{resume\}/);
    expect(src).toMatch(/onFocus=\{pause\}/);
    expect(src).toMatch(/onBlur=\{resume\}/);
  });
  it("gives the dismiss button a visible focus ring on the solid fill", () => {
    expect(src).toMatch(/focus-visible:ring-2/);
  });
  it("renames the row component so it no longer shadows the ToastItem type", () => {
    expect(src).toMatch(/function\s+ToastRow\b/);
    expect(src).not.toMatch(/function\s+ToastItem\b/);
  });
});

describe("Batch 6 — AttachmentPreview drops the hardcoded rgba token fallback", () => {
  const src = read("src/components/ui/AttachmentPreview.tsx");
  it("uses var(--color-brand-subtle) with no rgba literal fallback", () => {
    expect(src).not.toMatch(/rgba\(90,\s*75,\s*214/);
  });
});
