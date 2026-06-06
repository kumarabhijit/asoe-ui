/**
 * Operator journeys — attachment preview + in-document evidence highlighting
 * (ADR-043). Given/When/Then over the live sandbox backend, asserting against
 * re-fetched state + the honest safety-bar surface.
 *
 * The seed + assertion data MIRROR the mock fixtures in
 * `src/lib/mock-data/inbox-sections.ts` (SE_EMAIL / SE_ENTITIES) — same
 * attachment (PO_8842.pdf) and the same entity-derived anchors an operator sees
 * in mock mode — so the journeys exercise the canonical example end-to-end.
 *
 * These run against the live sandbox backend (uvicorn webServer) and the
 * `POST /api/v1/_sandbox/seed/email-attachment-anchors` seed endpoint, which
 * attaches a stored attachment + projected EvidenceAnchors to a seeded
 * EMAIL_ENTRY case. Real PDF.js render + the safety-bar verifier are exercised.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { loginAs, backendToken, resetTenant, exceptionUrl, expandSection, USERS } from "./_helpers";

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:8000";

interface AnchorSpec {
  text: string;
  label: string;
  supports_ref: string;
}

/**
 * Canonical example, mirrored from the mock SE_EMAIL / SE_ENTITIES bundle. The
 * anchor `text` values are the entities' `source_span` (what the backend binds),
 * and the labels match the mock's `_anchorLabel` mapping.
 */
const SE_EXAMPLE = {
  attachmentName: "PO_8842.pdf",
  attachmentMime: "application/pdf",
  poText: "PO# EML-PO-2026-0042",
  anchors: [
    { text: "PO# EML-PO-2026-0042", label: "PO number", supports_ref: "order_entry.customer_po" },
    { text: "ship to Atlanta DC", label: "Ship-to", supports_ref: "order_entry.ship_to" },
    { text: "need by May 24", label: "Requested date", supports_ref: "order_entry.requested_date" },
    { text: "Cola 12pk x 600", label: "Material", supports_ref: "order_entry.material" },
  ] as AnchorSpec[],
};

/** Seed an EMAIL_ENTRY exception whose case carries a stored attachment + the
 *  given evidence anchors, over a rendered document text. Pending backend
 *  endpoint (see header). */
async function seedAttachmentWithAnchors(
  request: APIRequestContext,
  token: string,
  opts: { documentText: string; attachmentName: string; attachmentMime: string; anchors: AnchorSpec[] },
): Promise<string> {
  const res = await request.post(
    `${BACKEND_URL}/api/v1/_sandbox/seed/email-attachment-anchors`,
    {
      headers: { Authorization: `Bearer ${token}` },
      // Backend request body is snake_case (extra="forbid") — see
      // docs/specs/sandbox-attachment-anchor-seed.md. anchors[] is already
      // snake_case (text/label/supports_ref).
      data: {
        document_text: opts.documentText,
        attachment_name: opts.attachmentName,
        attachment_mime: opts.attachmentMime,
        anchors: opts.anchors,
      },
    },
  );
  if (!res.ok()) throw new Error(`seed anchors: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { exception_id: string };
  return body.exception_id;
}

async function openPreview(
  request: APIRequestContext,
  token: string,
  page: import("@playwright/test").Page,
  exceptionId: string,
): Promise<void> {
  await page.goto(await exceptionUrl(request, token, exceptionId));
  await expandSection(page, /source email/i);
  await page.getByRole("button", { name: /^preview/i }).first().click();
  await expect(page.getByTestId("evidence-safety-bar")).toBeVisible({ timeout: 15_000 });
}

/** The safety-bar row for the PO-number anchor (the decision-driving value). */
function poRow(page: import("@playwright/test").Page) {
  return page
    .locator('[data-testid="evidence-safety-bar"] li')
    .filter({ hasText: "PO number" })
    .first();
}

test.describe("ADR-043 — attachment preview & evidence highlighting", () => {
  test("operator verifies a located evidence value in the document", async ({ page, request }) => {
    // GIVEN a MANAGER and an EMAIL_ENTRY case whose PO appears once in the doc
    const token = await backendToken(request, USERS.MANAGER);
    await resetTenant(request, token);
    const exId = await seedAttachmentWithAnchors(request, token, {
      documentText: `Purchase Order ${SE_EXAMPLE.poText} — ship to Atlanta DC, need by May 24. Cola 12pk x 600.`,
      attachmentName: SE_EXAMPLE.attachmentName,
      attachmentMime: SE_EXAMPLE.attachmentMime,
      anchors: SE_EXAMPLE.anchors,
    });
    await loginAs(page, USERS.MANAGER);

    // WHEN the operator opens the attachment preview
    await openPreview(request, token, page, exId);

    // THEN the PO anchor is shown LOCATED (status by icon + text, WCAG 1.4.1)
    const row = poRow(page);
    await expect(row).toHaveAttribute("data-status", "located");
    await expect(row).toContainText("PO number");
    await expect(row).toContainText(SE_EXAMPLE.poText);
  });

  test("field↔source: selecting an evidence row foregrounds it (verify-against-source)", async ({ page, request }) => {
    // GIVEN a located PO anchor
    const token = await backendToken(request, USERS.MANAGER);
    await resetTenant(request, token);
    const exId = await seedAttachmentWithAnchors(request, token, {
      documentText: `Purchase Order ${SE_EXAMPLE.poText} — ship to Atlanta DC, need by May 24. Cola 12pk x 600.`,
      attachmentName: SE_EXAMPLE.attachmentName,
      attachmentMime: SE_EXAMPLE.attachmentMime,
      anchors: SE_EXAMPLE.anchors,
    });
    await loginAs(page, USERS.MANAGER);
    await openPreview(request, token, page, exId);

    // WHEN the operator activates the PO evidence row (the row is a toggle)
    const rowButton = poRow(page).getByRole("button").first();
    await expect(rowButton).toHaveAttribute("aria-pressed", "false");
    await rowButton.click();

    // THEN it is foregrounded (aria-pressed + a visible "Highlighted" marker),
    // and toggling again clears it — never colour alone (WCAG 1.4.1).
    await expect(rowButton).toHaveAttribute("aria-pressed", "true");
    await expect(rowButton).toContainText(/highlighted/i);
    await rowButton.click();
    await expect(rowButton).toHaveAttribute("aria-pressed", "false");
  });

  test("a value absent from the document is shown UNLOCATED, never silently", async ({ page, request }) => {
    // GIVEN the PO anchor whose text does not appear in the rendered (scanned) doc
    const token = await backendToken(request, USERS.MANAGER);
    await resetTenant(request, token);
    const exId = await seedAttachmentWithAnchors(request, token, {
      documentText: "A scanned page with no machine-readable text layer.",
      attachmentName: SE_EXAMPLE.attachmentName,
      attachmentMime: SE_EXAMPLE.attachmentMime,
      anchors: [SE_EXAMPLE.anchors[0]],
    });
    await loginAs(page, USERS.MANAGER);

    // WHEN the operator opens the preview
    await openPreview(request, token, page, exId);

    // THEN absence is shown as loudly as a hit (no silent missing highlight)
    const row = poRow(page);
    await expect(row).toHaveAttribute("data-status", "unlocated");
    await expect(row).toContainText(/verify manually/i);
  });

  test("a repeated value is shown AMBIGUOUS (position approximate)", async ({ page, request }) => {
    const token = await backendToken(request, USERS.MANAGER);
    await resetTenant(request, token);
    const exId = await seedAttachmentWithAnchors(request, token, {
      documentText: `Header ${SE_EXAMPLE.poText} ... line-item reference ${SE_EXAMPLE.poText}`,
      attachmentName: SE_EXAMPLE.attachmentName,
      attachmentMime: SE_EXAMPLE.attachmentMime,
      anchors: [SE_EXAMPLE.anchors[0]],
    });
    await loginAs(page, USERS.MANAGER);

    await openPreview(request, token, page, exId);

    await expect(poRow(page)).toHaveAttribute("data-status", "ambiguous");
  });

  test("the preview shows the non-dismissable 'highlight is not authorization' banner", async ({ page, request }) => {
    const token = await backendToken(request, USERS.MANAGER);
    await resetTenant(request, token);
    const exId = await seedAttachmentWithAnchors(request, token, {
      documentText: `Purchase Order ${SE_EXAMPLE.poText}`,
      attachmentName: SE_EXAMPLE.attachmentName,
      attachmentMime: SE_EXAMPLE.attachmentMime,
      anchors: SE_EXAMPLE.anchors,
    });
    await loginAs(page, USERS.MANAGER);

    await openPreview(request, token, page, exId);

    // THEN the disclaimer is present and has no dismiss control
    const banner = page.getByTestId("highlight-disclaimer");
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("button")).toHaveCount(0);
  });
});
