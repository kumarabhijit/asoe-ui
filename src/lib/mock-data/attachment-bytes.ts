/**
 * Mock attachment bytes — TYPE-CORRECT so a downloaded mock file actually opens
 * (a `.pdf` must be a real PDF, not text named `.pdf`). Used only in mock mode
 * (`NEXT_PUBLIC_USE_REAL_API` unset); the real backend streams genuine bytes.
 */

/** Build a minimal, single-page, openable PDF as an ASCII string (so it is a
 *  valid Blob string part). xref offsets are byte offsets; the document is
 *  ASCII-only so char positions == byte positions. */
function makeMinimalPdf(title: string): string {
  const enc = new TextEncoder();
  const safe = title.replace(/[\\()]/g, "\\$&");
  const stream = `BT /F1 18 Tf 64 720 Td (${safe}) Tj ET`;
  const objects = [
    "<</Type /Catalog /Pages 2 0 R>>",
    "<</Type /Pages /Kids [3 0 R] /Count 1>>",
    "<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 5 0 R>>>> /Contents 4 0 R>>",
    `<</Length ${enc.encode(stream).length}>>\nstream\n${stream}\nendstream`,
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
}): Blob {
  const name = opts.fileName ?? opts.attachmentId;
  const mime = opts.mimeType ?? "";
  const isPdf = mime === "application/pdf" || /\.pdf$/i.test(name);
  const isImage =
    (mime.startsWith("image/") && mime !== "image/svg+xml") ||
    /\.(png|jpe?g|gif|webp)$/i.test(name);
  const isCsv = mime === "text/csv" || /\.csv$/i.test(name);

  if (isPdf) {
    return new Blob([makeMinimalPdf(`Mock attachment - ${name}`)], { type: "application/pdf" });
  }
  if (isImage) {
    return pngBlob();
  }
  if (isCsv) {
    return new Blob(
      [
        `field,value\nattachment_id,${opts.attachmentId}\ncase_id,${opts.caseId}\n` +
          "note,mock CSV (set NEXT_PUBLIC_USE_REAL_API=1 for real bytes)\n",
      ],
      { type: "text/csv" },
    );
  }
  return new Blob(
    [
      `Mock attachment ${name} (case ${opts.caseId}).\n` +
        "Set NEXT_PUBLIC_USE_REAL_API=1 to fetch real attachment bytes.",
    ],
    { type: mime || "text/plain" },
  );
}
