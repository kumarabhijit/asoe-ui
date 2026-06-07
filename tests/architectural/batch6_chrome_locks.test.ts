/**
 * UX remediation Batch 6 — source locks for the shared chrome/status fixes
 * (report 07). Structural fixes whose value a behavioural test can't easily
 * reach; each anchored to a real audit finding so the lock fails on the
 * parent commit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

function read(rel: string): string {
  return readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");
}

describe("Batch 6 — PreprodIdentityBanner", () => {
  const src = read("src/components/ui/PreprodIdentityBanner.tsx");

  it("uses the warning-toned ShieldAlert, not the reassuring ShieldCheck", () => {
    expect(src).toMatch(/ShieldAlert/);
    expect(src).not.toMatch(/ShieldCheck/);
  });

  it("reads session.user.email without the unsafe double-cast", () => {
    expect(src).not.toMatch(/as unknown as \{ email/);
    expect(src).toMatch(/session\?\.user\?\.email/);
  });

  it("no longer leaks the raw ASOE_AUTH_MODE=entra env string to operators", () => {
    expect(src).not.toMatch(/ASOE_AUTH_MODE=entra/);
  });
});

describe("Batch 6 — CaseViewBanner", () => {
  const src = read("src/components/ui/CaseViewBanner.tsx");

  it("does not duplicate the /cases link (single trailing CTA)", () => {
    // Was an inline <Link>/cases</Link> AND a trailing CTA. Exactly one Link.
    const links = src.match(/<Link\b/g) ?? [];
    expect(links.length).toBe(1);
  });

  it("drops the dev-jargon '/cases' inline link text", () => {
    expect(src).not.toMatch(/>\s*\/cases\s*<\/Link>/);
  });
});

describe("Batch 6 — StatusAnnouncer relies on the sr-only class (no dup inline style)", () => {
  const src = read("src/components/ui/StatusAnnouncer.tsx");
  it("removes the inline style that duplicated .sr-only", () => {
    // The clip-rect belt-and-suspenders inline style is gone; the
    // sr-only class is the single source of the visually-hidden treatment.
    expect(src).not.toMatch(/clip:\s*["']rect\(0,0,0,0\)["']/);
    expect(src).toMatch(/className="sr-only"/);
  });
});

describe("Batch 6 — Logo decorative icon is aria-hidden", () => {
  const src = read("src/components/ui/Logo.tsx");
  it("marks the Layers brand glyph aria-hidden (wordmark text carries meaning)", () => {
    expect(src).toMatch(/<Layers[^>]*aria-hidden="true"/);
  });
});
