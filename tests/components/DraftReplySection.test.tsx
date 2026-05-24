/**
 * DraftReplySection — render / data-presence behaviour (ADR-042 Phase 7). Dumb
 * projector of the reply draft; REJECTED shows reason + no body; optional fields
 * flow through <EvidenceBlock> (no ad-hoc placeholders, Guardrail #6).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { DraftReplySection } from "@/app/exceptions/DraftReplySection";
import type { DraftReply } from "@/types/exceptions";

const DRAFTED: DraftReply = {
  status: "DRAFTED",
  reason: null,
  template_name: "clarify_po",
  recipient: "buyer@walmart.example",
  subject: "Re: PO 0093847612",
  body: "Hello, could you confirm the requested quantity?",
  edits_applied: [{ field: "subject", before: "Re: PO", after: "Re: PO 0093847612" }],
  drafted_by: "analyst-1",
  drafted_at: "2026-05-24T10:00:00Z",
};

const REJECTED: DraftReply = {
  status: "REJECTED",
  reason: "No recipient on file",
  template_name: null,
  recipient: null,
  subject: null,
  body: null,
  edits_applied: [],
  drafted_by: null,
  drafted_at: null,
};

describe("DraftReplySection", () => {
  it("renders a DRAFTED reply with recipient, subject, body, and edits", () => {
    render(<DraftReplySection data={DRAFTED} />);
    expect(screen.getByText("DRAFTED")).toBeInTheDocument();
    expect(screen.getByText("buyer@walmart.example")).toBeInTheDocument();
    // Appears as the subject field + the edit's "after" value.
    expect(screen.getAllByText("Re: PO 0093847612").length).toBeGreaterThan(0);
    expect(screen.getByText(/confirm the requested quantity/)).toBeInTheDocument();
    expect(screen.getByText("subject")).toBeInTheDocument();
    expect(screen.getByText(/Drafted by analyst-1/)).toBeInTheDocument();
  });

  it("renders a REJECTED reply with its reason and no body (no placeholder)", () => {
    render(<DraftReplySection data={REJECTED} />);
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
    expect(screen.getByText("No recipient on file")).toBeInTheDocument();
    expect(screen.queryByText("Body")).not.toBeInTheDocument();
    expect(screen.queryByText(/^(—|N\/A)$/)).not.toBeInTheDocument();
  });
});
