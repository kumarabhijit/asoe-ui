/**
 * AgentActivityRail tests (cockpit-refactor).
 *
 * The cockpit's xl-rail "what the agents did" tenant. Mirrors
 * RecordPreviewRail: self-contained, fetches the selected record's trace
 * on selection change, renders the shared EventsTimeline from
 * trace.executed_nodes. Null-record / empty-trace cases render nothing and
 * report `false` so the parent can collapse the rail column.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentActivityRail } from "@/app/cases/AgentActivityRail";

const traceMock = vi.fn();

vi.mock("@/lib/api", () => ({
  exceptionsApi: {
    trace: (...args: unknown[]) => traceMock(...args),
  },
}));

beforeEach(() => traceMock.mockReset());
afterEach(() => vi.clearAllMocks());

describe("AgentActivityRail — no selection", () => {
  it("renders nothing and does not fetch when no record is selected", () => {
    const { container } = render(<AgentActivityRail />);
    expect(container).toBeEmptyDOMElement();
    expect(traceMock).not.toHaveBeenCalled();
  });

  it("reports false on mount with no selection", () => {
    const onContentfulChange = vi.fn();
    render(<AgentActivityRail onContentfulChange={onContentfulChange} />);
    expect(onContentfulChange).toHaveBeenCalledWith(false);
  });
});

describe("AgentActivityRail — with a trace", () => {
  it("renders the activity stream from trace.executed_nodes", async () => {
    traceMock.mockResolvedValue({
      executed_nodes: [
        { node: "classify", status: "completed" },
        { node: "shadow_audit", status: "completed" },
      ],
      final_status: "MANUAL_REVIEW_REQUIRED",
    });
    render(<AgentActivityRail selectedRecordId="exc-1" />);
    expect(
      await screen.findByRole("region", { name: /agent activity/i }),
    ).toBeInTheDocument();
    expect(traceMock).toHaveBeenCalledWith("exc-1");
  });

  it("reports true once a non-empty trace loads", async () => {
    const onContentfulChange = vi.fn();
    traceMock.mockResolvedValue({
      executed_nodes: [{ node: "classify", status: "completed" }],
    });
    render(
      <AgentActivityRail selectedRecordId="exc-1" onContentfulChange={onContentfulChange} />,
    );
    await waitFor(() => expect(onContentfulChange).toHaveBeenCalledWith(true));
  });

  it("renders nothing when the trace has no executed nodes", async () => {
    traceMock.mockResolvedValue({ executed_nodes: [] });
    const { container } = render(<AgentActivityRail selectedRecordId="exc-1" />);
    await waitFor(() => expect(traceMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the trace fetch fails (best-effort tenant)", async () => {
    const onContentfulChange = vi.fn();
    traceMock.mockRejectedValueOnce(new Error("500"));
    const { container } = render(
      <AgentActivityRail selectedRecordId="exc-1" onContentfulChange={onContentfulChange} />,
    );
    // Wait for the catch handler to settle (it sets trace=null → stays empty).
    await waitFor(() => expect(traceMock).toHaveBeenCalledWith("exc-1"));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    // Best-effort: a failed fetch reports no content, never throws.
    expect(onContentfulChange).toHaveBeenCalledWith(false);
  });
});
