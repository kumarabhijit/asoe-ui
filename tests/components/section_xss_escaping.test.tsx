/**
 * DoR #10 (XSS) render lock — backend free-text fields are escaped, not executed.
 *
 * Feeds classic XSS payloads through the backend-text fields of SOX-evidence
 * sections (reply body/subject, email body excerpt, EDI raw segments) and proves
 * React renders them as inert text: the literal payload string is present and no
 * <script> / event-handler-bearing element is created in the DOM.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { DraftReplySection } from "@/app/exceptions/DraftReplySection";
import { EmailSourceSection } from "@/app/exceptions/EmailSourceSection";
import { Edi850Section } from "@/app/exceptions/Edi850Section";
import type {
  DraftReply,
  EmailSourceData,
  Edi850Document,
} from "@/types/exceptions";

const SCRIPT = "<script>window.__pwned=1</script>";
const IMG = '<img src=x onerror="window.__pwned=1">';

function assertInert(container: HTMLElement, payload: string) {
  // The payload survives as literal text...
  expect(container.textContent).toContain(payload);
  // ...but never as live DOM: no injected <script>, no onerror handler.
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img[onerror]")).toBeNull();
  // The global the payload tries to set must never appear.
  expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
}

describe("section XSS escaping (DoR #10)", () => {
  it("DraftReplySection escapes a scripted body + subject", () => {
    const data: DraftReply = {
      status: "DRAFTED",
      reason: null,
      template_name: "clarify_po",
      recipient: "buyer@x.example",
      subject: `Re: ${SCRIPT}`,
      body: `Hello ${IMG} please confirm.`,
      edits_applied: [],
      drafted_by: "analyst-1",
      drafted_at: "2026-05-24T10:00:00Z",
    };
    const { container } = render(<DraftReplySection data={data} />);
    assertInert(container, SCRIPT);
    assertInert(container, IMG);
  });

  it("EmailSourceSection escapes a scripted body excerpt + subject", () => {
    const data: EmailSourceData = {
      from_address: "buyer@x.example",
      received_at: "2026-05-24T09:00:00Z",
      subject: `Order ${SCRIPT}`,
      body_hash: "abc123",
      attachment_manifest: [],
      body_excerpt: `Please ship ${IMG} today.`,
      source_email_id: null,
    };
    const { container } = render(<EmailSourceSection data={data} />);
    assertInert(container, SCRIPT);
  });

  it("Edi850Section escapes scripted raw X12 segments", () => {
    const data: Edi850Document = {
      standard: "ANSI X12 5010",
      transaction_set: "850",
      envelope: { sender_id: "S", receiver_id: "R", interchange_control_number: "1", group_control_number: "1", transaction_set_control_number: "1", usage_indicator: "P", x12_version: "005010" },
      header: { purpose_code: "00", po_type: "SA", po_number: "PO1", po_date: null, currency: null, requested_delivery_date: null },
      parties: [],
      line_items: [],
      totals: { total_line_items: 0, total_quantity: 0, total_amount: null },
      segments: [{ seg_id: "REF", elements: [], raw: `REF*${SCRIPT}~`, meaning: "Reference", group: "header" }],
      raw_x12: `REF*${SCRIPT}~`,
    };
    const { container } = render(<Edi850Section data={data} />);
    // raw_x12 is shown in the Raw X12 sub-view; the segment-map meaning is shown
    // by default. The scripted segment id/raw must be inert wherever rendered.
    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
  });
});
