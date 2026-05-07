// tests/views/documents.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-15 / D-20): smoke + DI-shape contract test +
// validateUpload-before-saveDocument trust-boundary verification (CODE-09).
import { describe, it, expect, vi } from "vitest";
import {
  renderDocuments,
  createDocumentsView,
  uploadWithValidation,
} from "../../src/views/documents.js";

describe("src/views/documents.js — Wave 4 Pattern D extraction", () => {
  it("exports renderDocuments as a function", () => {
    expect(typeof renderDocuments).toBe("function");
  });

  it("createDocumentsView returns DI-bound view", () => {
    const view = createDocumentsView({ state: {}, h: () => document.createElement("div") });
    expect(typeof view.renderDocuments).toBe("function");
  });

  it("uploadWithValidation calls validateUpload BEFORE saveDocument (CODE-09 / D-15)", async () => {
    const validateUpload = vi.fn(
      async () =>
        /** @type {{ ok: true, sanitisedName: string }} */ ({ ok: true, sanitisedName: "ok.pdf" }),
    );
    const saveDocument = vi.fn(async () => undefined);
    const notify = vi.fn();
    const file = { name: "ok.pdf", size: 100, type: "application/pdf" };
    await uploadWithValidation({
      file,
      orgId: "o1",
      meta: {},
      validateUpload,
      saveDocument,
      notify,
    });
    expect(validateUpload).toHaveBeenCalledWith(file);
    expect(saveDocument).toHaveBeenCalled();
    // verify ordering — validateUpload's call order index < saveDocument's
    expect(validateUpload.mock.invocationCallOrder[0]).toBeLessThan(
      saveDocument.mock.invocationCallOrder[0],
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it("uploadWithValidation aborts and notifies when validation fails", async () => {
    const validateUpload = vi.fn(
      async () =>
        /** @type {{ ok: false, reason: string }} */ ({ ok: false, reason: "Too large" }),
    );
    const saveDocument = vi.fn(async () => undefined);
    const notify = vi.fn();
    await uploadWithValidation({
      file: { name: "x.pdf", size: 99999999, type: "application/pdf" },
      orgId: "o1",
      meta: {},
      validateUpload,
      saveDocument,
      notify,
    });
    expect(validateUpload).toHaveBeenCalled();
    expect(saveDocument).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("error", expect.stringContaining("Too large"));
  });
});
