/**
 * RecordPreviewRail tests — PO finding 2026-05-28 #1
 * (UX panel synthesis: AI-drafted reply as Phase-1 rail tenant).
 *
 * Component fetches the selected record's analysis on mount /
 * selection change and renders <DraftReplySection> when
 * analysis.draft_reply is present. Null-record / no-draft cases
 * render nothing.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecordPreviewRail } from "@/app/cases/RecordPreviewRail";

const orderAnalysisMock = vi.fn();

vi.mock("@/lib/api", () => ({
  exceptionsApi: {
    orderAnalysis: (...args: unknown[]) => orderAnalysisMock(...args),
  },
}));

beforeEach(() => {
  orderAnalysisMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("RecordPreviewRail — no selection", () => {
  it("renders nothing when selectedRecordId is undefined", () => {
    const { container } = render(<RecordPreviewRail />);
    expect(container).toBeEmptyDOMElement();
    expect(orderAnalysisMock).not.toHaveBeenCalled();
  });

  it("renders nothing when selectedRecordId is null", () => {
    const { container } = render(
      <RecordPreviewRail selectedRecordId={null} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(orderAnalysisMock).not.toHaveBeenCalled();
  });
});

describe("RecordPreviewRail — no draft on analysis", () => {
  it("renders nothing when analysis has no draft_reply", async () => {
    orderAnalysisMock.mockResolvedValue({
      diagnosis: "x",
      confidence: 80,
      risk: "LOW",
      resolution: "y",
      lines: [],
    });
    const { container } = render(
      <RecordPreviewRail selectedRecordId="rec-1" />,
    );
    // Wait for the analysis fetch to settle
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when analysis is null (fetch error)", async () => {
    orderAnalysisMock.mockRejectedValue(new Error("boom"));
    const { container } = render(
      <RecordPreviewRail selectedRecordId="rec-1" />,
    );
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RecordPreviewRail — happy path", () => {
  it("renders the DraftReplySection when draft_reply is present", async () => {
    orderAnalysisMock.mockResolvedValue({
      diagnosis: "x",
      confidence: 80,
      risk: "LOW",
      resolution: "y",
      lines: [],
      draft_reply: {
        status: "DRAFTED",
        subject: "Re: Order increase",
        body: "Thank you for your request...",
        to: "buyer@acme-corp.com",
      },
    });
    render(<RecordPreviewRail selectedRecordId="rec-1" />);
    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /Draft reply preview/i }),
      ).toBeInTheDocument();
    });
    // DraftReplySection should mount inside the rail section.
    // The subject text comes from the canned draft data above.
    expect(screen.getByText(/Re: Order increase/i)).toBeInTheDocument();
  });

  it("refetches when selectedRecordId changes", async () => {
    orderAnalysisMock.mockResolvedValue({
      diagnosis: "x",
      confidence: 80,
      risk: "LOW",
      resolution: "y",
      lines: [],
    });
    const { rerender } = render(
      <RecordPreviewRail selectedRecordId="rec-1" />,
    );
    await act(async () => {});
    expect(orderAnalysisMock).toHaveBeenCalledWith("rec-1");

    rerender(<RecordPreviewRail selectedRecordId="rec-2" />);
    await act(async () => {});
    expect(orderAnalysisMock).toHaveBeenCalledWith("rec-2");
    expect(orderAnalysisMock).toHaveBeenCalledTimes(2);
  });
});
