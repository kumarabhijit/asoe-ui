/**
 * EmailSourceSection tests — email source-of-truth substrate (ADR-034 Phase G).
 *
 * Mirrors the layout of EdiMismatchSection.test.tsx /
 * EmailOrderEntrySection.test.tsx so the suite reads uniformly across
 * enrichment sections.
 *
 * Covers:
 *   - Header fields render (from / received / subject).
 *   - Audit-bearing absence path: null body_hash → no "—" placeholder,
 *     dev warning fires from EvidenceBlock.
 *   - body_excerpt is contextual: present → rendered; absent → block
 *     suppressed entirely (Pillar 3 structural omission).
 *   - Attachment manifest: empty list (audit-bearing absence behaviour),
 *     populated list renders rows with size formatted, and `mime_type`
 *     verbatim.
 *   - Body hash surfaced in monospace at the bottom (audit-trail substrate).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmailSourceSection } from "@/app/exceptions/EmailSourceSection";
import type { EmailSourceData } from "@/types/exceptions";

const base: EmailSourceData = {
  from_address: "buyer@stub-customer.example",
  received_at: "2026-04-30T10:12:00Z",
  subject: "PO submission — stub",
  body_hash:
    "a7f5e3d1b9c0648f2a1e7c9b4d5e6f3c2a1b0d9e8f7c6b5a4938271605040301",
  attachment_manifest: [
    {
      name: "purchase_order.pdf",
      mime_type: "application/pdf",
      bytes: 12_345,
    },
  ],
  body_excerpt: "Please process the attached PO. Ship to Atlanta DC.",
};

describe("EmailSourceSection", () => {
  describe("header fields", () => {
    it("renders from_address verbatim", () => {
      render(<EmailSourceSection data={base} />);
      expect(screen.getByText("buyer@stub-customer.example")).toBeInTheDocument();
    });

    it("renders received_at verbatim", () => {
      render(<EmailSourceSection data={base} />);
      expect(screen.getByText("2026-04-30T10:12:00Z")).toBeInTheDocument();
    });

    it("renders subject verbatim", () => {
      render(<EmailSourceSection data={base} />);
      expect(screen.getByText("PO submission — stub")).toBeInTheDocument();
    });
  });

  describe("body_excerpt (contextual)", () => {
    it("renders the excerpt when present", () => {
      render(<EmailSourceSection data={base} />);
      expect(
        screen.getByText(/Please process the attached PO/i),
      ).toBeInTheDocument();
    });

    it("absent body_excerpt → block omitted entirely (Pillar 3)", () => {
      render(<EmailSourceSection data={{ ...base, body_excerpt: null }} />);
      expect(screen.queryByText(/Body excerpt/i)).toBeNull();
    });

    it("undefined body_excerpt → block omitted entirely", () => {
      const { body_excerpt: _drop, ...rest } = base;
      void _drop;
      render(<EmailSourceSection data={rest as EmailSourceData} />);
      expect(screen.queryByText(/Body excerpt/i)).toBeNull();
    });
  });

  describe("attachment manifest", () => {
    it("renders attachment names + mime types + formatted bytes", () => {
      render(<EmailSourceSection data={base} />);
      expect(screen.getByText("purchase_order.pdf")).toBeInTheDocument();
      expect(screen.getByText("application/pdf")).toBeInTheDocument();
      // 12_345 bytes → "12.1 KB" via formatBytes() internals.
      expect(screen.getByText(/KB/i)).toBeInTheDocument();
    });

    it("renders multi-attachment manifest as separate rows", () => {
      render(
        <EmailSourceSection
          data={{
            ...base,
            attachment_manifest: [
              { name: "a.pdf", mime_type: "application/pdf", bytes: 100 },
              { name: "b.csv", mime_type: "text/csv", bytes: 50 },
              { name: "c.png", mime_type: "image/png", bytes: 2_000_000 },
            ],
          }}
        />,
      );
      expect(screen.getByText("a.pdf")).toBeInTheDocument();
      expect(screen.getByText("b.csv")).toBeInTheDocument();
      expect(screen.getByText("c.png")).toBeInTheDocument();
      // 2_000_000 bytes → "1.9 MB"
      expect(screen.getByText(/MB/i)).toBeInTheDocument();
    });

    it("empty manifest fires audit-bearing dev warning rather than rendering '—' (Guardrail #6)", () => {
      // attachment_manifest is audit-bearing per registry; an empty list
      // is treated as absent by EvidenceBlock.isPresent. Composer is
      // expected to route to AUDIT_CONTEXT_MISSING upstream — but if the
      // section ever sees the empty list, the dev warning fires and
      // nothing user-facing renders for the manifest.
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        render(
          <EmailSourceSection
            data={{ ...base, attachment_manifest: [] }}
          />,
        );
        // No "—" placeholder anywhere.
        expect(screen.queryByText("—")).toBeNull();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("audit-bearing"),
        );
      } finally {
        warn.mockRestore();
      }
    });

    it("formats sub-1KB sizes in bytes", () => {
      render(
        <EmailSourceSection
          data={{
            ...base,
            attachment_manifest: [
              { name: "tiny.txt", mime_type: "text/plain", bytes: 412 },
            ],
          }}
        />,
      );
      expect(screen.getByText("412 B")).toBeInTheDocument();
    });
  });

  describe("audit-trail substrate", () => {
    it("renders body_hash in monospace at the bottom", () => {
      render(<EmailSourceSection data={base} />);
      expect(screen.getByText(base.body_hash)).toBeInTheDocument();
    });

    it("audit-bearing absence on body_hash logs the dev warning rather than rendering '—'", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        render(
          <EmailSourceSection
            data={{ ...base, body_hash: "" } as EmailSourceData}
          />,
        );
        expect(screen.queryByText("—")).toBeNull();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("audit-bearing"),
        );
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe("a11y", () => {
    it("sets a meaningful aria-label on the section landmark", () => {
      render(<EmailSourceSection data={base} />);
      expect(
        screen.getByRole("region", { name: /Source email/i }),
      ).toBeInTheDocument();
    });
  });
});
