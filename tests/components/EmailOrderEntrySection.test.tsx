/**
 * EmailOrderEntrySection tests — classification × floor-status × confidence
 * matrix (ADR-034 Phase C close-out).
 *
 * Covers the same surface as EdiMismatchSection.test.tsx:
 *   - Classification badge mapping (4 cases) + forward-compat fallback.
 *   - Floor-status grid renders all four booleans with icon + text
 *     (WCAG 1.4.1) and reflects breach state.
 *   - Composite confidence display (raw float + 0–100 derived).
 *   - Conditional reject_reason_code: predicate hold (FATAL_REJECT)
 *     renders the reason; predicate fail renders nothing (no "—" /
 *     "N/A" partial-truth placeholder, per Guardrail #6).
 *   - Empty validation_failures array → contextual list omitted entirely
 *     (Pillar 3 structural omission).
 *   - Audit-bearing absence on floor_status logs the dev warning and
 *     renders nothing (composer drift is the upstream guard).
 *   - Recommended action + autonomy_level surface.
 *
 * Mirrors EdiMismatchSection.test.tsx layout so the suite reads
 * uniformly across enrichment sections.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmailOrderEntrySection } from "@/app/exceptions/EmailOrderEntrySection";
import type {
  EmailOrderEntryAnalysisData,
  EmailOrderEntryClassification,
} from "@/types/exceptions";

const allGreenFloor: EmailOrderEntryAnalysisData["floor_status"] = {
  sender_authorized: true,
  customer_resolved: true,
  duplicate_po_clear: true,
  credit_clear: true,
};

const base: EmailOrderEntryAnalysisData = {
  composite_confidence: 0.88,
  classification: "STANDARD_REVIEW",
  recommended_action: "REQUEST_CLARIFICATION",
  autonomy_level: "L2",
  validation_failures: ["ambiguous_ship_to"],
  floor_breaches: [],
  reject_reason_code: null,
  floor_status: allGreenFloor,
  notification_template: "email_order_clarification_request",
};


describe("EmailOrderEntrySection", () => {
  describe("classification badge", () => {
    it("ONE_CLICK_APPROVE renders 'One-click approve'", () => {
      render(
        <EmailOrderEntrySection
          data={{
            ...base,
            classification: "ONE_CLICK_APPROVE",
            recommended_action: "ONE_CLICK_APPROVE",
            autonomy_level: "L3",
            composite_confidence: 0.97,
            validation_failures: [],
          }}
        />,
      );
      // Issue #133 (PO #15): "One-click approve" renders as the
      // classification badge label. The assertion is satisfied as long as
      // the phrase renders at least once.
      expect(screen.getAllByText(/One-click approve/i).length).toBeGreaterThan(0);
    });

    it("STANDARD_REVIEW renders 'Standard review'", () => {
      render(<EmailOrderEntrySection data={{ ...base, classification: "STANDARD_REVIEW" }} />);
      // Issue #133 PO #14 — the ConstraintsPipeline graph also names
      // the classification on the terminal node, so the label
      // appears both in the badge and in the SVG. Either presence
      // satisfies the assertion.
      expect(screen.getAllByText(/Standard review/i).length).toBeGreaterThan(0);
    });

    it("LOW_CONFIDENCE renders 'Low confidence'", () => {
      render(
        <EmailOrderEntrySection
          data={{
            ...base,
            classification: "LOW_CONFIDENCE",
            recommended_action: "LOW_CONFIDENCE_FLAG",
            autonomy_level: "L1",
            composite_confidence: 0.50,
            validation_failures: [],
          }}
        />,
      );
      expect(screen.getAllByText(/Low confidence/i).length).toBeGreaterThan(0);
    });

    it("FATAL_REJECT renders 'Fatal reject'", () => {
      render(
        <EmailOrderEntrySection
          data={{
            ...base,
            classification: "FATAL_REJECT",
            recommended_action: "REJECT",
            autonomy_level: "L1",
            reject_reason_code: "credit_block",
            floor_breaches: ["credit_clear"],
            floor_status: { ...allGreenFloor, credit_clear: false },
          }}
        />,
      );
      expect(screen.getAllByText(/Fatal reject/i).length).toBeGreaterThan(0);
    });

    it("renders an unknown classification with the neutral fallback rather than crashing (CLAUDE.md Guardrail #1)", () => {
      // Forward-compat scenario: asoe2 ships a new
      // EmailOrderEntryClassification literal the UI bundle hasn't seen.
      // Render must not throw and the literal is surfaced verbatim.
      const newLiteral = "PENDING_REVALIDATION" as EmailOrderEntryClassification;
      expect(() =>
        render(<EmailOrderEntrySection data={{ ...base, classification: newLiteral }} />),
      ).not.toThrow();
      // Surfaced verbatim both in the classification badge and the
      // ConstraintsPipeline terminal node caption.
      expect(screen.getAllByText("PENDING_REVALIDATION").length).toBeGreaterThan(0);
    });
  });

  describe("composite confidence", () => {
    it("renders the integer percentage and the raw float", () => {
      render(<EmailOrderEntrySection data={{ ...base, composite_confidence: 0.88 }} />);
      // Integer percent.
      expect(screen.getByText("88%")).toBeInTheDocument();
      // Raw float for audit fidelity.
      expect(screen.getByText(/0\.88/)).toBeInTheDocument();
    });

    it("frames the composite as a model score when calibration is not reported (ADR-032)", () => {
      render(<EmailOrderEntrySection data={{ ...base, composite_confidence: 0.88 }} />);
      expect(
        screen.getByRole("group", { name: /model score.*not a validated probability/i }),
      ).toBeInTheDocument();
    });

    it("frames the composite as calibrated when the signal reports it", () => {
      render(
        <EmailOrderEntrySection
          data={{
            ...base,
            composite_confidence: 0.88,
            composite_confidence_signal: { value: 0.88, calibrated: true },
          }}
        />,
      );
      expect(
        screen.getByRole("group", { name: /calibrated confidence/i }),
      ).toBeInTheDocument();
    });

    it("rounds 0.954 to 95% rather than displaying the raw float as the headline", () => {
      render(<EmailOrderEntrySection data={{ ...base, composite_confidence: 0.954 }} />);
      expect(screen.getByText("95%")).toBeInTheDocument();
    });
  });

  describe("non-disable-able floor checks", () => {
    it("all-green renders four 'passed' rows", () => {
      render(<EmailOrderEntrySection data={base} />);
      expect(screen.getByText(/Sender authorised/i)).toBeInTheDocument();
      expect(screen.getByText(/Customer resolved/i)).toBeInTheDocument();
      expect(screen.getByText(/Duplicate PO clear/i)).toBeInTheDocument();
      expect(screen.getByText(/Credit clear/i)).toBeInTheDocument();
      // All four should show "passed" (visible label, plus sr-only).
      const passed = screen.getAllByText(/passed/i);
      // Each row renders two elements with "passed" — a visible badge
      // and the sr-only redundancy label per WCAG 1.4.1.
      expect(passed.length).toBeGreaterThanOrEqual(4);
    });

    it("a breached floor renders 'breached' with text accompanying the icon (WCAG 1.4.1)", () => {
      render(
        <EmailOrderEntrySection
          data={{
            ...base,
            classification: "FATAL_REJECT",
            recommended_action: "REJECT",
            autonomy_level: "L1",
            reject_reason_code: "sender_unauthorized",
            floor_breaches: ["sender_authorized"],
            floor_status: { ...allGreenFloor, sender_authorized: false },
          }}
        />,
      );
      // The visible "breached" label appears for the breached row.
      const breached = screen.getAllByText(/breached/i);
      expect(breached.length).toBeGreaterThan(0);
    });

    it("audit-bearing absence on floor_status logs the dev warning rather than rendering '—'", () => {
      // Pillar-1 guarantees the composer routes to
      // AUDIT_CONTEXT_MISSING upstream when floor_status is absent.
      // If a section ever sees null, it must NOT render a partial-truth
      // placeholder. Type-cast to bypass the required-prop guard since
      // we're explicitly testing the defensive path.
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        render(
          <EmailOrderEntrySection
            data={
              {
                ...base,
                floor_status: null,
              } as unknown as EmailOrderEntryAnalysisData
            }
          />,
        );
        // No "—" / "N/A" placeholder anywhere.
        expect(screen.queryByText("—")).toBeNull();
        expect(screen.queryByText("N/A")).toBeNull();
        // Dev warning fires from EvidenceBlock so the regression is visible.
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("audit-bearing"),
        );
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe("validation_failures (contextual)", () => {
    it("renders each failure code in the list when present", () => {
      render(
        <EmailOrderEntrySection
          data={{
            ...base,
            validation_failures: ["ambiguous_ship_to", "missing_delivery_date"],
          }}
        />,
      );
      expect(screen.getByText("ambiguous_ship_to")).toBeInTheDocument();
      expect(screen.getByText("missing_delivery_date")).toBeInTheDocument();
    });

    it("empty validation_failures → header omitted entirely (Pillar 3 structural omission)", () => {
      render(
        <EmailOrderEntrySection
          data={{
            ...base,
            classification: "ONE_CLICK_APPROVE",
            recommended_action: "ONE_CLICK_APPROVE",
            autonomy_level: "L3",
            composite_confidence: 0.97,
            validation_failures: [],
          }}
        />,
      );
      expect(screen.queryByText(/Validation failures/i)).toBeNull();
    });
  });

  describe("reject_reason_code (conditional on FATAL_REJECT)", () => {
    it("predicate holds (FATAL_REJECT) → renders the reason verbatim", () => {
      render(
        <EmailOrderEntrySection
          data={{
            ...base,
            classification: "FATAL_REJECT",
            recommended_action: "REJECT",
            autonomy_level: "L1",
            reject_reason_code: "credit_block",
            floor_breaches: ["credit_clear"],
            floor_status: { ...allGreenFloor, credit_clear: false },
          }}
        />,
      );
      expect(screen.getByText(/Reject reason/i)).toBeInTheDocument();
      expect(screen.getByText("credit_block")).toBeInTheDocument();
    });

    it("predicate fails (any non-FATAL_REJECT) → block omitted, no '—' rendered", () => {
      // STANDARD_REVIEW with reject_reason_code accidentally non-null:
      // EvidenceBlock's conditional predicate is false → nothing renders.
      render(
        <EmailOrderEntrySection
          data={{
            ...base,
            classification: "STANDARD_REVIEW",
            // Even if the upstream payload carried a stale reason code,
            // the predicate gates it away.
            reject_reason_code: null,
          }}
        />,
      );
      expect(screen.queryByText(/Reject reason/i)).toBeNull();
      expect(screen.queryByText("—")).toBeNull();
    });
  });

  describe("recommended action + autonomy", () => {
    it("renders the recommended_action verbatim", () => {
      render(<EmailOrderEntrySection data={base} />);
      expect(screen.getByText("REQUEST_CLARIFICATION")).toBeInTheDocument();
    });

    it("renders the autonomy_level under the autonomy footer", () => {
      render(<EmailOrderEntrySection data={base} />);
      expect(screen.getByText(/Autonomy/i)).toBeInTheDocument();
      // Issue #133 (PO #15) — bare "L2" was opaque; the autonomy footer now
      // LEADS with the plain-language caption via `autonomyLevelLabel()`,
      // keeping the level code as a de-emphasised parenthetical (audit-bearing).
      expect(screen.getByText(/Execute & notify \(L2\)/)).toBeInTheDocument();
    });

    it("renders notification_template when present", () => {
      render(<EmailOrderEntrySection data={base} />);
      expect(screen.getByText(/email_order_clarification_request/i)).toBeInTheDocument();
    });

    it("notification_template absent → no notification line", () => {
      render(
        <EmailOrderEntrySection
          data={{ ...base, notification_template: null }}
        />,
      );
      expect(screen.queryByText(/Notification:/i)).toBeNull();
    });
  });
});
