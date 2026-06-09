/**
 * ADR-045 CP2 — exc-046 summary-zone terminology coherence.
 *
 * The named defect: the exc-046 detail surface described one record with
 * six competing strings. The worst summary-zone offender was the
 * HeaderRibbon dumping the raw event token "EMAIL ORDER ENTRY REQUEST".
 * exc-046 arrived over EDI (order_id EDI-PO-2026-7781) with
 * event_type=EMAIL_ORDER_ENTRY_REQUEST and intent=MANUAL_ORDER_INTAKE.
 *
 * The summary zone must now read the governed intent label
 * ("Manual Order Intake") and must NOT leak the raw event token or the
 * "Email Order Intake" misnomer. (The raw token still belongs in the
 * Diagnostics/audit zone — asserted separately.)
 *
 * Fails on the parent commit, where HeaderRibbon rendered
 * `detail.event_type.replace(/_/g, " ")`.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { HeaderRibbon } from "@/app/exceptions/HeaderRibbon";
import type { ExceptionDetail } from "@/types/exceptions";

// HeaderRibbon reads only a handful of fields; a partial cast keeps the
// fixture focused on the terminology surface under test.
const exc046 = {
  id: "exc-046",
  tenant_id: "acme-corp",
  order_id: "EDI-PO-2026-7781",
  event_type: "EMAIL_ORDER_ENTRY_REQUEST",
  intent: "MANUAL_ORDER_INTAKE",
  lifecycle_state: "RESOLVED",
  shadow_verdict: "GREEN",
} as unknown as ExceptionDetail;

describe("exc-046 summary terminology (ADR-045)", () => {
  it("shows the governed intent label, not the raw event token", () => {
    render(
      <HeaderRibbon detail={exc046} primarySkuLabel="SKU-1" totalPo={1000} delta={0} />,
    );
    expect(screen.getByText("Manual Order Intake")).toBeInTheDocument();
  });

  it("does not leak the raw event token into the summary", () => {
    const { container } = render(
      <HeaderRibbon detail={exc046} primarySkuLabel="SKU-1" totalPo={1000} delta={0} />,
    );
    expect(container.textContent).not.toContain("EMAIL ORDER ENTRY REQUEST");
    expect(container.textContent).not.toContain("Email Order Intake");
  });
});

// Council follow-up 2026-06-09 — in the /cases workspace the left queue row
// already carries id / customer / state / $, so the embedded HeaderRibbon
// must NOT re-surface the Type (channel jargon) or the order total (a second
// $ figure competing with the ImpactBar's at-risk number). It keeps only the
// per-record lifecycle "Current State". Standalone keeps the full chrome.
describe("HeaderRibbon embedded slimming (workspace de-duplication)", () => {
  it("drops Type and the order total when embedded", () => {
    const { container } = render(
      <HeaderRibbon detail={exc046} primarySkuLabel="SKU-1" totalPo={1000} delta={250} embedded />,
    );
    expect(screen.queryByText("Manual Order Intake")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("Type:");
    expect(container.textContent).not.toContain("$1,000");
    // The per-record lifecycle state survives (decision-relevant).
    expect(container.textContent).toContain("RESOLVED");
  });

  it("keeps Type and the order total when standalone (no left pane)", () => {
    const { container } = render(
      <HeaderRibbon detail={exc046} primarySkuLabel="SKU-1" totalPo={1000} delta={0} />,
    );
    expect(screen.getByText("Manual Order Intake")).toBeInTheDocument();
    expect(container.textContent).toContain("$1,000");
  });
});
