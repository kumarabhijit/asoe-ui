/**
 * CP-D component test — AttachmentDownloadButton (ADR-043). Fetches bytes via
 * the api client (mocked) and triggers a browser download; disabled when the
 * attachment has no stored id.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AttachmentDownloadButton } from "@/components/ui/AttachmentDownloadButton";
import type { EmailAttachmentManifestEntry } from "@/types/exceptions";

vi.mock("@/lib/api", () => ({ attachmentsApi: { getBlob: vi.fn() } }));
import { attachmentsApi } from "@/lib/api";

const getBlob = vi.mocked(attachmentsApi.getBlob);

function att(overrides: Partial<EmailAttachmentManifestEntry> = {}): EmailAttachmentManifestEntry {
  return { name: "PO_8842.pdf", mime_type: "application/pdf", bytes: 100, sha256: "a".repeat(64), attachment_id: "att-1", ...overrides };
}

beforeEach(() => {
  getBlob.mockReset();
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => "blob:mock");
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
});

describe("AttachmentDownloadButton", () => {
  it("fetches the attachment bytes by case + id on click", async () => {
    getBlob.mockResolvedValue(new Blob(["x"], { type: "text/plain" }));
    render(<AttachmentDownloadButton caseId="case-1" attachment={att()} />);
    fireEvent.click(screen.getByRole("button", { name: /download PO_8842\.pdf/i }));
    await waitFor(() =>
      expect(getBlob).toHaveBeenCalledWith(
        "case-1",
        "att-1",
        expect.objectContaining({ fileName: "PO_8842.pdf", mimeType: "application/pdf" }),
      ),
    );
  });

  it("is disabled when the attachment has no stored id", () => {
    render(<AttachmentDownloadButton caseId="case-1" attachment={att({ attachment_id: null })} />);
    expect(screen.getByRole("button", { name: /download/i })).toBeDisabled();
  });

  // REGRESSION (fails on parent): the download used try/finally with NO catch,
  // so a failed evidence fetch was swallowed silently on a SOX surface. The
  // failure must now surface to the operator (role=alert).
  it("surfaces a failed download instead of swallowing it", async () => {
    getBlob.mockRejectedValue(new Error("403 forbidden"));
    render(<AttachmentDownloadButton caseId="case-1" attachment={att()} />);
    fireEvent.click(screen.getByRole("button", { name: /download PO_8842\.pdf/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/403 forbidden/i),
    );
  });
});
