// tests/ui/upload.test.js
// @ts-check
// Phase 4 Wave 2 (D-15 / D-16, CODE-09): magic-byte sniff coverage for
// PDF/JPEG/PNG/DOCX/XLSX/TXT + size cap + filename sanitisation. The
// allowlist + MAX_BYTES are exported as the single source of truth for
// Phase 5 storage.rules + Phase 7 callable validation per D-15.
import { describe, it, expect } from "vitest";
import {
  validateUpload,
  ALLOWED_MIME_TYPES,
  MAX_BYTES,
} from "../../src/ui/upload.js";

/** @param {number[]} bytes @param {string} type @param {string} name */
function makeFile(bytes, type, name) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("ALLOWED_MIME_TYPES + MAX_BYTES exports (D-15 / D-16)", () => {
  it("exports a Set with 6 entries", () => {
    expect(ALLOWED_MIME_TYPES).toBeInstanceOf(Set);
    expect(ALLOWED_MIME_TYPES.size).toBe(6);
  });

  it("MAX_BYTES is exactly 25 MiB (CODE-09)", () => {
    expect(MAX_BYTES).toBe(25 * 1024 * 1024);
  });

  it("Set contains the canonical 6 MIME types", () => {
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
    expect(
      ALLOWED_MIME_TYPES.has(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
    expect(
      ALLOWED_MIME_TYPES.has(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("text/plain")).toBe(true);
  });
});

describe("validateUpload() — size + allowlist gates", () => {
  it("rejects files larger than MAX_BYTES with /too large/ reason", async () => {
    // Mock the size getter to avoid allocating 25 MB+1 in happy-dom
    const file = makeFile([0x25, 0x50, 0x44, 0x46, 0x2d], "application/pdf", "x.pdf");
    Object.defineProperty(file, "size", { value: MAX_BYTES + 1 });
    const r = await validateUpload(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/too large/i);
  });

  it("rejects files whose declared MIME is not in the allowlist", async () => {
    const file = makeFile([0, 0, 0, 0], "application/x-msdownload", "evil.exe");
    const r = await validateUpload(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not allowed/i);
  });
});

describe("validateUpload() — magic-byte signatures (D-16)", () => {
  it("accepts a PDF with %PDF- magic bytes", async () => {
    const file = makeFile(
      [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34],
      "application/pdf",
      "report.pdf",
    );
    const r = await validateUpload(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sanitisedName).toBe("report.pdf");
  });

  it("accepts a JPEG with FF D8 FF magic bytes", async () => {
    const file = makeFile(
      [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0],
      "image/jpeg",
      "pic.jpg",
    );
    const r = await validateUpload(file);
    expect(r.ok).toBe(true);
  });

  it("accepts a PNG with 89 50 4E 47 0D 0A 1A 0A magic bytes", async () => {
    const file = makeFile(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      "image/png",
      "shot.png",
    );
    const r = await validateUpload(file);
    expect(r.ok).toBe(true);
  });

  it("accepts a DOCX (ZIP magic + correct declaredType)", async () => {
    const file = makeFile(
      [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "doc.docx",
    );
    const r = await validateUpload(file);
    expect(r.ok).toBe(true);
  });

  it("accepts a XLSX (ZIP magic + correct declaredType)", async () => {
    const file = makeFile(
      [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "sheet.xlsx",
    );
    const r = await validateUpload(file);
    expect(r.ok).toBe(true);
  });

  it("accepts a TXT with text/plain declared and no NUL byte", async () => {
    const file = makeFile([0x68, 0x65, 0x6c, 0x6c, 0x6f], "text/plain", "notes.txt");
    const r = await validateUpload(file);
    expect(r.ok).toBe(true);
  });

  it("rejects MIME mismatch — declared image/jpeg but content is PDF magic", async () => {
    const file = makeFile(
      [0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0],
      "image/jpeg",
      "fake.jpg",
    );
    const r = await validateUpload(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/mismatch/i);
  });
});

describe("validateUpload() — filename sanitisation (CODE-09)", () => {
  it("strips path traversal + special chars and returns sanitisedName", async () => {
    // CODE-09 spec: replace /[^\w.\- ]/g with _, then slice(0, 200).
    // The regex KEEPS literal `.` (it's inside the char class), so dots in the
    // input survive. Path-traversal is mitigated server-side by the Storage
    // path being keyed off the doc id, not the filename — this client-side
    // sanitisation is the audit-narrative claim, not the trust boundary
    // (D-15: Phase 5 storage.rules + Phase 7 callable validation enforce).
    const file = makeFile(
      [0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0],
      "application/pdf",
      "../../etc/p@sswd!.pdf",
    );
    const r = await validateUpload(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sanitisedName).toBe(".._.._etc_p_sswd_.pdf");
  });

  it("truncates names longer than 200 chars (slice(0,200))", async () => {
    const longName = "a".repeat(250) + ".pdf";
    const file = makeFile(
      [0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0],
      "application/pdf",
      longName,
    );
    const r = await validateUpload(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sanitisedName.length).toBe(200);
  });
});
