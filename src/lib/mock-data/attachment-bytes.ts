/**
 * Mock attachment bytes — TYPE-CORRECT so a downloaded mock file actually opens
 * (a `.pdf` must be a real PDF, not text named `.pdf`). Used only in mock mode
 * (`NEXT_PUBLIC_USE_REAL_API` unset); the real backend streams genuine bytes.
 */

import { isPo8842, PO_8842_SPATIAL_FIELDS } from "./po8842-spatial";

// US-Letter page box the mock renders on (PDF user-space, origin BOTTOM-left).
const PAGE_W = 612;
const PAGE_H = 792;

const _escapePdf = (s: string): string => s.replace(/[\\()]/g, "\\$&");

/** Assemble a single-page PDF around a ready-built content stream. xref offsets
 *  are byte offsets computed via TextEncoder so a stray multibyte char stays
 *  correct. Shared by the simple and positioned builders. */
function _assemblePdf(content: string): string {
  const enc = new TextEncoder();
  const objects = [
    "<</Type /Catalog /Pages 2 0 R>>",
    "<</Type /Pages /Kids [3 0 R] /Count 1>>",
    `<</Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources <</Font <</F1 5 0 R>>>> /Contents 4 0 R>>`,
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

/** Build a minimal, single-page, openable PDF as an ASCII string (so it is a
 *  valid Blob string part). Each line is rendered as its own text run so a PDF
 *  text-layer extractor (PDF.js) reads each back contiguously — which lets the
 *  preview verifier LOCATE embedded evidence text. */
function makeMinimalPdf(lines: string[]): string {
  const safe = (lines.length ? lines : ["Mock attachment"]).map(_escapePdf);
  let content = "BT /F1 12 Tf 64 720 Td";
  safe.forEach((l, i) => {
    content += i === 0 ? ` (${l}) Tj` : ` 0 -18 Td (${l}) Tj`;
  });
  content += " ET";
  return _assemblePdf(content);
}

interface PositionedRun {
  text: string;
  /** PDF user-space (origin bottom-left). */
  x: number;
  y: number;
  size?: number;
}

/** Build a PDF that places each run at an absolute position (text matrix `Tm`),
 *  so the rendered glyphs land where a caller wants them — used to put each
 *  PO_8842 evidence span under its recorded bbox so the spatial overlay aligns. */
function makePositionedPdf(runs: PositionedRun[]): string {
  let content = "";
  for (const r of runs) {
    const size = r.size ?? 12;
    content +=
      `BT /F1 ${size} Tf 1 0 0 1 ${r.x.toFixed(2)} ${r.y.toFixed(2)} Tm ` +
      `(${_escapePdf(r.text)}) Tj ET\n`;
  }
  return _assemblePdf(content);
}

/** Render the PO_8842 document with each recorded evidence span placed UNDER
 *  its bbox, so the backend-authoritative spatial overlays (ADR-045) sit on the
 *  real text. A normalised top-left bbox `[x0,y0,x1,y1]` maps to a PDF baseline
 *  near the box bottom: `x = x0·W`, `y = H·(1−y1) + pad`. Each evidence span is
 *  emitted EXACTLY ONCE (a duplicate would make the safety bar read AMBIGUOUS).
 *  Non-geometry evidence (e.g. the From: header) stacks in a footer band. */
function makePo8842Pdf(evidenceText: string[]): string {
  const runs: PositionedRun[] = [
    // Title carries no evidence span (avoids a duplicate match).
    { text: "PURCHASE ORDER", x: 64, y: PAGE_H - 56, size: 16 },
  ];
  const placed = new Set<string>();
  for (const f of PO_8842_SPATIAL_FIELDS) {
    runs.push({
      text: f.text,
      x: f.bbox[0] * PAGE_W + 2,
      y: PAGE_H * (1 - f.bbox[3]) + 6,
      size: 13,
    });
    placed.add(f.text);
  }
  // Evidence without recorded geometry (e.g. the From: header) — keep it in the
  // text layer so its text-derived anchor still LOCATES, below the box band.
  let fy = PAGE_H * (1 - 0.52);
  for (const t of evidenceText) {
    if (placed.has(t)) continue;
    runs.push({ text: t, x: 64, y: fy, size: 11 });
    fy -= 18;
  }
  return makePositionedPdf(runs);
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
    // The PO_8842 demo document places each evidence span under its recorded
    // bbox so the ADR-045 spatial overlays land on the real text; every other
    // mock PDF uses the simple top-down layout.
    const body = isPo8842(name)
      ? makePo8842Pdf(evidence)
      : makeMinimalPdf([`Mock attachment - ${name}`, ...evidence]);
    return new Blob([body], { type: "application/pdf" });
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
