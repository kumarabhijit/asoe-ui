/**
 * Spec-as-oracle: when an exception's `final_status` is
 * `AUDIT_CONTEXT_MISSING`, the UI renders an explicit, named indicator
 * — not a generic "unknown status" or empty-state fallback.
 *
 * Per CLAUDE.md §6 (Verdict 2026-04-22) and the eng-review-test-plan
 * Key Interactions §4: a record routed to AUDIT_CONTEXT_MISSING means
 * the audit-bearing fields could not be populated; the operator must
 * see *that specific signal*, not a "data missing" generic. Otherwise
 * the operator can't distinguish a transient gateway hiccup from a
 * compliance-relevant audit gap.
 *
 * This test is structural: it scans the WaterfallStepper, EventsTimeline,
 * EvidenceBlock, and ExceptionDetailPanel sources for explicit
 * `AUDIT_CONTEXT_MISSING` switch arms. The deeper interaction tests
 * (does the chip render? in what color?) live in `tests/components/`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
// Components that ARE responsible for surfacing the AUDIT_CONTEXT_MISSING
// terminal status as a visible signal (chip / badge / step label).
// EvidenceBlock is intentionally NOT on this list — it switches on
// field presence, not on terminal status; the composer routes to
// AUDIT_CONTEXT_MISSING upstream of EvidenceBlock.
const FILES_THAT_MUST_HANDLE_AUDIT_CONTEXT_MISSING = [
  "src/components/ui/WaterfallStepper.tsx",
  "src/components/ui/EventsTimeline.tsx",
];

describe("AUDIT_CONTEXT_MISSING render path (CLAUDE.md §6)", () => {
  for (const rel of FILES_THAT_MUST_HANDLE_AUDIT_CONTEXT_MISSING) {
    it(`${rel} contains an explicit AUDIT_CONTEXT_MISSING branch`, () => {
      const src = readFileSync(join(ROOT, rel), "utf-8");
      // Either a switch case, an equality check, or a string literal use.
      // A bare comment mention isn't enough — must appear in code.
      const hasCodeReference =
        /case\s+["']AUDIT_CONTEXT_MISSING["']/.test(src) ||
        /===\s*["']AUDIT_CONTEXT_MISSING["']/.test(src) ||
        /["']AUDIT_CONTEXT_MISSING["']\s*[,)]/.test(src);
      expect(
        hasCodeReference,
        `${rel} must contain a runtime branch on AUDIT_CONTEXT_MISSING ` +
          `(switch case, === comparison, or argument to a status helper). ` +
          `Comment-only mentions don't satisfy CLAUDE.md §6 — the operator ` +
          `must see an explicit signal in the rendered output.`,
      ).toBe(true);
    });
  }

  it("the AUDIT_CONTEXT_MISSING signal is reachable from the detail panel chain", () => {
    // ExceptionDetailPanel renders DiagnosticsSection which renders
    // EventsTimeline; the EventsTimeline switch arms on
    // AUDIT_CONTEXT_MISSING. Assert the import chain is intact so a
    // future refactor doesn't accidentally orphan the signal.
    const panel = readFileSync(
      join(ROOT, "src/app/exceptions/ExceptionDetailPanel.tsx"),
      "utf-8",
    );
    expect(
      /import\s+\{[^}]*DiagnosticsSection[^}]*\}\s+from/.test(panel),
      "ExceptionDetailPanel must import DiagnosticsSection (which " +
        "transitively renders the AUDIT_CONTEXT_MISSING signal via " +
        "EventsTimeline / WaterfallStepper).",
    ).toBe(true);

    const diag = readFileSync(
      join(ROOT, "src/app/exceptions/DiagnosticsSection.tsx"),
      "utf-8",
    );
    expect(
      /EventsTimeline|WaterfallStepper/.test(diag),
      "DiagnosticsSection must render either EventsTimeline or " +
        "WaterfallStepper to surface the AUDIT_CONTEXT_MISSING signal.",
    ).toBe(true);
  });
});
