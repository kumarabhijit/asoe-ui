/**
 * Magic-byte preview-format detection (ADR-043 §2.1) — the TS mirror of
 * `asoe2/api/preview.py::detect_preview_format`. The viewer picks a renderer
 * from the *bytes*, never the attacker-supplied mime_type, and DEFAULT-DENIES:
 * anything off the allowlist (notably SVG and HTML — XSS vectors) is
 * download-only, not rendered.
 */

export type PreviewFormat = "pdf" | "image" | "text";

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return false;
  return true;
}

export function detectPreviewFormat(bytes: Uint8Array): PreviewFormat | null {
  if (!bytes || bytes.length < 4) return null;

  // PDF — "%PDF"
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf";

  // Raster images (allowlisted).
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image"; // PNG
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image"; // JPEG
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image"; // GIF8
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && // RIFF
    bytes.length >= 12 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return "image";
  }

  // Plain text / CSV — conservative: no NUL, valid UTF-8, and not markup.
  // This denies SVG ("<svg…") and HTML ("<!doctype"/"<html") by construction.
  for (let i = 0; i < Math.min(bytes.length, 16); i++) {
    if (bytes[i] === 0) return null;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  if (text.trimStart().startsWith("<")) return null;
  return "text";
}
