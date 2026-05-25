/**
 * Mock attachment bytes — TYPE-CORRECT so a downloaded mock file actually opens
 * (a `.pdf` must be a real PDF, not text named `.pdf`). Used only in mock mode
 * (`NEXT_PUBLIC_USE_REAL_API` unset); the real backend streams genuine bytes.
 */

/** Build a minimal, single-page, openable PDF as an ASCII string (so it is a
 *  valid Blob string part). Each line is rendered as its own text run so a PDF
 *  text-layer extractor (PDF.js) reads each back contiguously — which lets the
 *  preview verifier LOCATE embedded evidence text. xref offsets are byte
 *  offsets; computed via TextEncoder so a stray multibyte char stays correct. */
function makeMinimalPdf(lines: string[]): string {
  const enc = new TextEncoder();
  const safe = (lines.length ? lines : ["Mock attachment"]).map((l) =>
    l.replace(/[\\()]/g, "\\$&"),
  );
  let content = "BT /F1 12 Tf 64 720 Td";
  safe.forEach((l, i) => {
    content += i === 0 ? ` (${l}) Tj` : ` 0 -18 Td (${l}) Tj`;
  });
  content += " ET";
  const objects = [
    "<</Type /Catalog /Pages 2 0 R>>",
    "<</Type /Pages /Kids [3 0 R] /Count 1>>",
    "<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 5 0 R>>>> /Contents 4 0 R>>",
    `<</Length ${enc.encode(content).length}>>\nstream\n${content}\nendstream`,
    "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(enc.encode(body).length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = enc.encode(body).length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    body += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<</Size ${objects.length + 1} /Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  return body;
}

// 1x1 transparent PNG.
const PNG_1x1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

function pngBlob(): Blob {
  const bin = atob(PNG_1x1_BASE64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: "image/png" });
}

export function mockAttachmentBlob(opts: {
  attachmentId: string;
  caseId: string;
  mimeType?: string;
  fileName?: string;
  /** Verbatim evidence-anchor texts to embed in the synthesized document so the
   *  preview's safety bar LOCATES them in mock mode (matches what the operator
   *  sees against the real backend). */
  evidenceText?: string[];
}): Blob {
  const name = opts.fileName ?? opts.attachmentId;
  const mime = opts.mimeType ?? "";
  const evidence = opts.evidenceText ?? [];
  const isPdf = mime === "application/pdf" || /\.pdf$/i.test(name);
  const isImage =
    (mime.startsWith("image/") && mime !== "image/svg+xml") ||
    /\.(png|jpe?g|gif|webp)$/i.test(name);
  const isCsv = mime === "text/csv" || /\.csv$/i.test(name);

  if (isPdf) {
    return new Blob([makeMinimalPdf([`Mock attachment - ${name}`, ...evidence])], {
      type: "application/pdf",
    });
  }
  if (isImage) {
    // Images have no text layer; evidence can't be embedded.
    return pngBlob();
  }
  if (isCsv) {
    const rows = [
      "field,value",
      `attachment_id,${opts.attachmentId}`,
      `case_id,${opts.caseId}`,
      ...evidence.map((t) => `evidence,"${t.replace(/"/g, '""')}"`),
    ];
    return new Blob([rows.join("\n") + "\n"], { type: "text/csv" });
  }
  const lines = [`Mock attachment ${name} (case ${opts.caseId}).`, ...evidence];
  return new Blob([lines.join("\n") + "\n"], { type: mime || "text/plain" });
}
