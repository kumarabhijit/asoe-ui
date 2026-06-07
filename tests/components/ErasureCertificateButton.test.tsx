/**
 * ErasureCertificateButton — PARITY-0.5 / PARITY-8 tenant-facing
 * download of the regulator-grade erasure certificate.
 *
 * The certificate endpoint is manager+admin only + tenant-scoped on
 * the backend; this UI component is a dumb projector — it triggers
 * the fetch through `attachmentsApi.getErasureCertificate`, packages
 * the JSON as a Blob, and surfaces the download. Mock mode returns
 * a deterministic certificate so the UI is exercisable in dev /
 * Vercel previews.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErasureCertificateButton } from "@/components/ui/ErasureCertificateButton";
import { attachmentsApi } from "@/lib/api";
import type { AttachmentErasureCertificate } from "@/lib/api";

const _origCreateObjectURL = URL.createObjectURL;
const _origRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  URL.createObjectURL = _origCreateObjectURL;
  URL.revokeObjectURL = _origRevokeObjectURL;
  vi.restoreAllMocks();
});

describe("ErasureCertificateButton", () => {
  it("renders a labelled download button", () => {
    render(<ErasureCertificateButton attachmentId="att-1" />);
    expect(
      screen.getByRole("button", {
        name: /erasure certificate for att-1/i,
      }),
    ).toBeInTheDocument();
  });

  it("invokes the API and fires onCertificate with the response", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(attachmentsApi, "getErasureCertificate");
    const captured: AttachmentErasureCertificate[] = [];
    render(
      <ErasureCertificateButton
        attachmentId="att-2"
        onCertificate={(cert) => captured.push(cert)}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /erasure certificate for att-2/i }),
    );
    expect(spy).toHaveBeenCalledWith("att-2");
    expect(captured).toHaveLength(1);
    expect(captured[0].attachment_id).toBe("att-2");
    // Tombstone shape is PII-free by registry contract — no `name`,
    // no `content`. Locking the field set defends against drift.
    expect(captured[0].tombstone).not.toHaveProperty("name");
    expect(captured[0].tombstone).not.toHaveProperty("content");
  });

  it("surfaces a backend error to the operator via role=alert", async () => {
    const user = userEvent.setup();
    vi.spyOn(attachmentsApi, "getErasureCertificate").mockRejectedValueOnce(
      new Error("FORBIDDEN: not allowed"),
    );
    render(<ErasureCertificateButton attachmentId="att-3" />);
    await user.click(
      screen.getByRole("button", { name: /erasure certificate for att-3/i }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/FORBIDDEN/);
    // REGRESSION (fails on parent): the error carried BOTH role="alert" and
    // aria-live="polite" — a contradiction (alert implies assertive). Only the
    // role should remain.
    expect(alert).not.toHaveAttribute("aria-live");
  });

  it("compact variant hides the text label but keeps the aria-label", () => {
    render(<ErasureCertificateButton attachmentId="att-4" compact />);
    const btn = screen.getByRole("button", {
      name: /erasure certificate for att-4/i,
    });
    expect(btn).toBeInTheDocument();
    expect(btn.textContent?.trim()).toBe("");
  });
});
