// src/ui/upload.js
// @ts-check
// Phase 4 Wave 2 (D-15 / D-16, CODE-09): NEW client-side upload validation
// helper that runs BEFORE data/documents.js per the trust-boundary contract:
// views/* call validateUpload(file) on the File from the input change event;
// on ok:false the view emits notify('error', reason) and aborts (no Storage
// write attempted); on ok:true the view passes the validated File +
// sanitisedName to data/documents.js's saveDocument(file, sanitisedName, meta)
// which does NOT re-validate (trust boundary at ui/upload.js).
//
// ALLOWED_MIME_TYPES is exported as the single source of truth so server-side
// enforcement (Phase 5 storage.rules + Phase 7 callable validation) can
// reference the same canonical allowlist — single allowlist, multiple
// enforcement points (CONTEXT.md `<specifics>` 8th bullet). Server-side is
// the trust boundary; this helper is the UX-feedback layer + audit narrative
// claim ("client validates declared+actual MIME, not just declared").

/** @typedef {"application/pdf"|"image/jpeg"|"image/png"|
 *   "application/vnd.openxmlformats-officedocument.wordprocessingml.document"|
 *   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"|
 *   "text/plain"} AllowedMime */

/** @type {ReadonlySet<AllowedMime>} */
export const ALLOWED_MIME_TYPES = new Set(
  /** @type {AllowedMime[]} */ ([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ]),
);

export const MAX_BYTES = 25 * 1024 * 1024; // 25 MiB (CODE-09)

/** @typedef {{ ok: true, sanitisedName: string } | { ok: false, reason: string }} ValidateResult */

/**
 * Magic-byte signature table (D-16). Returns the detected MIME, or null.
 * @param {Uint8Array} bytes
 * @param {string} declaredType
 * @returns {AllowedMime|null}
 */
function detectMime(bytes, declaredType) {
  // PDF: 25 50 44 46 2D
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // ZIP container (DOCX/XLSX): 50 4B 03 04 — disambiguate via declaredType
  if (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    if (
      declaredType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (
      declaredType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
  }
  // TXT: no magic bytes; UTF-8 + extension check (D-16) — accept if declared
  // type is text/plain AND the head contains no NUL byte (rules out binary
  // smuggled as text).
  if (declaredType === "text/plain" && !bytes.includes(0x00)) {
    return "text/plain";
  }
  return null;
}

/**
 * @param {string} name
 * @returns {string}
 */
function sanitiseName(name) {
  // CODE-09 spec verbatim: replace non-[\w.\- ] with _, then slice 0..200.
  return String(name).replace(/[^\w.\- ]/g, "_").slice(0, 200);
}

/**
 * Client-side upload validation (D-15 / D-16). Server-side enforcement is the
 * trust boundary (Phase 5 storage.rules + Phase 7 callable validation).
 *
 * @param {File} file
 * @returns {Promise<ValidateResult>}
 */
export async function validateUpload(file) {
  if (!file) return { ok: false, reason: "No file selected." };
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      reason: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB > 25 MB).`,
    };
  }
  if (!ALLOWED_MIME_TYPES.has(/** @type {AllowedMime} */ (file.type))) {
    return {
      ok: false,
      reason: `File type ${file.type || "(unknown)"} not allowed.`,
    };
  }
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const detected = detectMime(head, file.type);
  if (!detected) {
    return {
      ok: false,
      reason: "Unrecognised file content (magic-byte sniff failed).",
    };
  }
  if (detected !== file.type) {
    return {
      ok: false,
      reason: `File type mismatch — declared ${file.type} but content looks like ${detected}.`,
    };
  }
  return { ok: true, sanitisedName: sanitiseName(file.name) };
}
