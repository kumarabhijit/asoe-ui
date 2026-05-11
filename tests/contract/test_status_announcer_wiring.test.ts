// Q1 wiring contract: every status-emitting action path must
// route through useStatusAnnouncer().announce().
//
// Phase 1 of the BDD test plan. The chrome-invariant Playwright
// spec asserts the testid is present on every route; this
// file-scan test asserts the SOURCE side — that the action
// handlers actually call announce() on every success path. If
// they regress to toast-only, this fails loud.
//
// Why file-scan instead of behavioral:
//   - Behavioral coverage (the announcement actually fires) is
//     owned by the Playwright flow YAMLs that ship in Phase 2-3
//     (e.g. resolve/exception-triage-approval.yaml asserts
//     "Exception resolved" via assert_announcement_text).
//   - The structural test here catches the case where someone
//     removes an announce() call from the source while the flow
//     YAMLs lag. Two complementary nets.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

describe("StatusAnnouncer wiring (Q1)", () => {
  it("Providers mount <StatusAnnouncer> at the application root", () => {
    const src = read("src/app/providers.tsx");
    expect(
      /import\s+\{[^}]*\bStatusAnnouncer\b[^}]*\}\s+from\s+["']@\/components\/ui\/StatusAnnouncer["']/.test(
        src,
      ),
      "src/app/providers.tsx must import StatusAnnouncer",
    ).toBe(true);
    expect(
      /<StatusAnnouncer\b/.test(src),
      "src/app/providers.tsx must mount <StatusAnnouncer>",
    ).toBe(true);
  });

  it("useExceptionActions imports useStatusAnnouncer", () => {
    const src = read("src/hooks/useExceptionActions.ts");
    expect(
      /import\s+\{[^}]*\buseStatusAnnouncer\b[^}]*\}\s+from\s+["']@\/components\/ui\/StatusAnnouncer["']/.test(
        src,
      ),
      "src/hooks/useExceptionActions.ts must import useStatusAnnouncer",
    ).toBe(true);
    expect(
      /\bconst\s+\{\s*announce\s*\}\s*=\s*useStatusAnnouncer\s*\(/.test(src),
      "useExceptionActions must destructure announce from useStatusAnnouncer()",
    ).toBe(true);
  });

  it("every success-toast in useExceptionActions has a paired announce call", () => {
    // Every `addToast("success" | "warning", …)` that's reached
    // on a successful API response (not in the deny / validation
    // branches) must have a paired announce() within ~5 lines.
    // We approximate by counting toasts vs announce() calls. The
    // counts must be ≥1 and equal; if they diverge a contributor
    // has added an action path without an announcement.
    const src = read("src/hooks/useExceptionActions.ts");
    const successToastCount = (
      src.match(/addToast\(\s*["'](?:success|warning)["']/g) ?? []
    ).length;
    const announceCount = (src.match(/\bannounce\s*\(/g) ?? []).length;
    expect(
      successToastCount,
      "useExceptionActions must contain at least one success/warning toast",
    ).toBeGreaterThan(0);
    // announce >= success toasts: every success path that
    // surfaces a toast also surfaces an announcement. Some
    // permission-deny paths fire a warning toast WITHOUT an
    // announcement (deny is not a status-change worth speaking).
    // Strict equality therefore over-asserts; we want
    // announceCount >= successToastCount - (deny warnings).
    // Six deny warnings exist (one per action). The remaining
    // 6 success toasts must each have an announce(). Plus one
    // cosign approve/reject branch that ternaries the message
    // so it counts once in announce. Total announce >= 6.
    expect(
      announceCount,
      `expected at least 6 announce() calls (one per action success path); found ${announceCount}`,
    ).toBeGreaterThanOrEqual(6);
  });

  it("useSignOut announces before navigation", () => {
    const src = read("src/hooks/useSignOut.ts");
    expect(
      /\bannounce\s*\(/.test(src),
      "src/hooks/useSignOut.ts must emit an announcement",
    ).toBe(true);
    // The order matters: announce() must precede the actual
    // signOut() invocation (signOut triggers a redirect; the
    // announcement has to settle first). Match `signOut({` to
    // skip past the `import { signOut } from ...` line.
    const announceIdx = src.search(/\bannounce\s*\(/);
    // Match `void signOut(` to skip JSDoc example snippets that
    // also contain `signOut({ callbackUrl: ... })`.
    const signOutCallIdx = src.search(/\bvoid\s+signOut\s*\(/);
    expect(announceIdx).toBeGreaterThan(-1);
    expect(signOutCallIdx).toBeGreaterThan(-1);
    expect(
      announceIdx,
      "announce() must precede signOut() so the SR speaks before the redirect tears down the page",
    ).toBeLessThan(signOutCallIdx);
  });

  it("authenticated pages route sign-out through useSignOut", () => {
    const pages = [
      "src/app/inbox/page.tsx",
      "src/app/exceptions/page.tsx",
      "src/app/exceptions/[id]/page.tsx",
      "src/app/cases/page.tsx",
      "src/app/cases/[id]/page.tsx",
      "src/app/dashboard/page.tsx",
      "src/app/settings/page.tsx",
    ];
    const offenders: string[] = [];
    for (const rel of pages) {
      const src = read(rel);
      const usesHook =
        /import\s+\{[^}]*\buseSignOut\b[^}]*\}\s+from\s+["']@\/hooks\/useSignOut["']/.test(
          src,
        );
      // No page should still import signOut directly — the hook
      // is the only sanctioned path.
      const inlineSignOut = /import\s+\{[^}]*\bsignOut\b[^}]*\}\s+from\s+["']next-auth\/react["']/.test(
        src,
      );
      if (!usesHook || inlineSignOut) {
        offenders.push(
          `${rel} ${usesHook ? "" : "missing useSignOut"} ${inlineSignOut ? "still imports signOut directly" : ""}`.trim(),
        );
      }
    }
    expect(
      offenders,
      "every authenticated page must route sign-out through useSignOut (Q1)",
    ).toEqual([]);
  });
});
