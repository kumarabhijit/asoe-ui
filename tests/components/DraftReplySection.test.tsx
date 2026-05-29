/**
 * DraftReplySection — render / data-presence behaviour (ADR-042 Phase 7). Dumb
 * projector of the reply draft; REJECTED shows reason + no body; optional fields
 * flow through <EvidenceBlock> (no ad-hoc placeholders, Guardrail #6).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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

const VERSIONED: DraftReply = {
  ...DRAFTED,
  edits_applied: [],
  revisions: [
    {
      version: 1,
      subject: "Re: PO",
      body: "Hello, could you confirm the requested quantity?",
      edits_applied: [],
      author: "ai:ReplyDraftRecipe.py",
      authored_at: "2026-05-24T10:00:00Z",
      source: "AI_GENERATED",
    },
    {
      version: 2,
      subject: "Re: PO 0093847612",
      body: "Hello, could you confirm the requested quantity?",
      edits_applied: [{ field: "subject", before: "Re: PO", after: "Re: PO 0093847612" }],
      author: "csa@acme.example",
      authored_at: "2026-05-24T10:05:00Z",
      source: "OPERATOR_EDIT",
    },
  ],
};

describe("DraftReplySection", () => {
  it("renders a DRAFTED reply with recipient, subject, body", () => {
    render(<DraftReplySection data={DRAFTED} />);
    expect(screen.getByText("DRAFTED")).toBeInTheDocument();
    expect(screen.getByText("buyer@walmart.example")).toBeInTheDocument();
    expect(screen.getAllByText("Re: PO 0093847612").length).toBeGreaterThan(0);
    expect(screen.getByText(/confirm the requested quantity/)).toBeInTheDocument();
    expect(screen.getByText(/Drafted by analyst-1/)).toBeInTheDocument();
  });

  it("keeps the edit audit in a collapsed Version history disclosure (#3)", () => {
    render(<DraftReplySection data={DRAFTED} />);
    // The before/after edit row is NOT visible until the disclosure is opened
    // — it used to sit always-on at the bottom of the card (extraneous text).
    expect(screen.queryByText("subject")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /version history/i }));
    expect(screen.getByText("subject")).toBeInTheDocument();
  });

  it("shows the AI → operator revision chain when versions are present (#1)", () => {
    render(<DraftReplySection data={VERSIONED} />);
    fireEvent.click(screen.getByRole("button", { name: /version history/i }));
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Edited")).toBeInTheDocument();
  });

  it("renders a Jump to source email link only when sourceSectionId is set (#2)", () => {
    const { rerender } = render(<DraftReplySection data={DRAFTED} />);
    expect(screen.queryByRole("link", { name: /jump to source email/i })).not.toBeInTheDocument();
    rerender(<DraftReplySection data={DRAFTED} sourceSectionId="section-source-email" />);
    const link = screen.getByRole("link", { name: /jump to source email/i });
    expect(link).toHaveAttribute("href", "#section-source-email");
  });

  it("submits an operator edit through onSubmitEdit when canEdit (#1)", async () => {
    const onSubmitEdit = vi.fn().mockResolvedValue(undefined);
    render(<DraftReplySection data={DRAFTED} onSubmitEdit={onSubmitEdit} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /edit draft/i }));
    const body = screen.getByLabelText("Body");
    fireEvent.change(body, { target: { value: "Edited body." } });
    fireEvent.click(screen.getByRole("button", { name: /save edit/i }));
    await waitFor(() =>
      expect(onSubmitEdit).toHaveBeenCalledWith(
        expect.objectContaining({ body: "Edited body." }),
      ),
    );
  });

  it("hides the edit affordance when canEdit is false", () => {
    render(<DraftReplySection data={DRAFTED} onSubmitEdit={vi.fn()} canEdit={false} />);
    expect(screen.queryByRole("button", { name: /edit draft/i })).not.toBeInTheDocument();
  });

  it("renders an 'Edit in record detail' link on a read-only mount (no inline editor)", () => {
    render(<DraftReplySection data={DRAFTED} editInDetailHref="#section-draft-reply" />);
    expect(screen.queryByRole("button", { name: /edit draft/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit in record detail/i })).toHaveAttribute(
      "href",
      "#section-draft-reply",
    );
  });

  it("uses a distinct region label when provided (a11y disambiguation)", () => {
    render(<DraftReplySection data={DRAFTED} regionLabel="AI draft reply — preview" />);
    expect(screen.getByRole("region", { name: "AI draft reply — preview" })).toBeInTheDocument();
  });

  it("renders a REJECTED reply with its reason and no body (no placeholder)", () => {
    render(<DraftReplySection data={REJECTED} />);
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
    expect(screen.getByText("No recipient on file")).toBeInTheDocument();
    expect(screen.queryByText("Body")).not.toBeInTheDocument();
    expect(screen.queryByText(/^(—|N\/A)$/)).not.toBeInTheDocument();
  });
});
