// tests/views/knowledge-admin.test.js
// @ts-check
// Client Knowledge Agent staff preview panel: hidden unless the build flag is
// set, client-side file checks, upload + log + test-question flows, and
// answers rendered as text, never HTML.
import { describe, it, expect, vi } from "vitest";
import {
  bulletItems,
  uploadStates,
  checkFormFile,
  createKnowledgeAdminPanel,
  knowledgeAdminEnabled,
  MAX_UPLOAD_BYTES,
  toBase64,
} from "../../src/views/knowledge-admin.js";

// Microtask flush: the root test setup installs fake timers, so setTimeout never fires.
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const ORGS = [
  { id: "org-nw", name: "Northwind Analytics" },
  { id: "org-bf", name: "Bluefin Legal" },
];

/** @param {Partial<import("../../src/views/knowledge-admin.js").KnowledgeAdminDeps>} [over] */
function setup(over = {}) {
  const deps = {
    orgs: ORGS,
    ingest: vi.fn(async () => ({
      pillar: "1",
      sessionDate: "2026-11-11",
      chunks: 8,
      replacedChunks: 8,
    })),
    ask: vi.fn(async () => ({
      answer: "- Target cold-chain firms\n- Price per site",
      answered: true,
      hitCount: 8,
      model: "m",
      provider: "p",
      sources: [{ pillar: "1", sessionName: "ICP refresh", sessionDate: "2026-11-11" }],
    })),
    listUploads: vi.fn(async () => [
      {
        id: "u1",
        orgId: "org-nw",
        clientName: "Northwind Analytics",
        fileName: "p1.docx",
        uploadedBy: "a",
        status: /** @type {const} */ ("failed"),
        startedAt: "2026-11-16T09:00:00.000Z",
        error: "Form is for Bluefin",
      },
    ]),
    ...over,
  };
  const el = createKnowledgeAdminPanel(/** @type {*} */ (deps));
  document.body.replaceChildren(el);
  return { el, deps };
}

/** @param {HTMLElement} el @param {File} file */
function chooseFile(el, file) {
  const input = /** @type {HTMLInputElement} */ (el.querySelector('input[type="file"]'));
  Object.defineProperty(input, "files", { value: [file], configurable: true });
}

const button = (/** @type {HTMLElement} */ el, /** @type {string} */ label) =>
  /** @type {HTMLButtonElement} */ (
    [...el.querySelectorAll("button")].find((b) => b.textContent === label)
  );

describe("knowledgeAdminEnabled", () => {
  it("is on only when the build flag is exactly 1", () => {
    expect(knowledgeAdminEnabled({ VITE_KNOWLEDGE_ADMIN: "1" })).toBe(true);
    expect(knowledgeAdminEnabled({ VITE_KNOWLEDGE_ADMIN: "0" })).toBe(false);
    expect(knowledgeAdminEnabled({})).toBe(false);
    expect(knowledgeAdminEnabled()).toBe(false);
  });
});

describe("checkFormFile", () => {
  it("accepts a .docx under 5 MB only", () => {
    expect(checkFormFile(null)).toMatch(/Choose/);
    expect(checkFormFile({ name: "notes.pdf", size: 10 })).toMatch(/\.docx/);
    expect(checkFormFile({ name: "Form.DOCX", size: MAX_UPLOAD_BYTES + 1 })).toMatch(/5 MB/);
    expect(checkFormFile({ name: "Form.docx", size: 10 })).toBeNull();
  });
});

describe("toBase64", () => {
  it("round-trips bytes, including large buffers", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);
    const back = Uint8Array.from(atob(toBase64(bytes.buffer)), (c) => c.charCodeAt(0));
    expect(back).toEqual(bytes);
  });
});

describe("createKnowledgeAdminPanel", () => {
  it("asks for an organisation when there are none", () => {
    const { el, deps } = setup({ orgs: [] });
    expect(el.textContent).toMatch(/Create an organisation first/);
    expect(deps.listUploads).not.toHaveBeenCalled();
  });

  it("labels itself staff-only and loads the first client's upload log", async () => {
    const { el, deps } = setup();
    await flush();
    expect(el.textContent).toMatch(/Preview, staff only/);
    expect(el.textContent).toMatch(/Clients can't see any of this yet/);
    expect(deps.listUploads).toHaveBeenCalledWith({ orgId: "org-nw" });
    expect(el.querySelector(".knowledge-table")?.textContent).toMatch(
      /p1\.docx.*Failed.*Form is for Bluefin/,
    );
  });

  it("reloads the log when the client changes", async () => {
    const { el, deps } = setup();
    const select = /** @type {HTMLSelectElement} */ (el.querySelector("select"));
    select.value = "org-bf";
    select.dispatchEvent(new Event("change"));
    await flush();
    expect(deps.listUploads).toHaveBeenLastCalledWith({ orgId: "org-bf" });
  });

  it("refuses a non-docx file without calling the server", async () => {
    const { el, deps } = setup();
    chooseFile(el, new File(["x"], "notes.pdf"));
    button(el, "Upload form").click();
    await flush();
    expect(deps.ingest).not.toHaveBeenCalled();
    expect(el.querySelector(".knowledge-msg")?.textContent).toMatch(/\.docx/);
  });

  it("uploads a form for the selected client and refreshes the log", async () => {
    const { el, deps } = setup();
    await flush();
    chooseFile(el, new File([new Uint8Array([0x50, 0x4b, 3, 4])], "Pillar 1.docx"));
    button(el, "Upload form").click();
    await vi.waitFor(() => expect(deps.ingest).toHaveBeenCalled());
    expect(deps.ingest).toHaveBeenCalledWith({
      orgId: "org-nw",
      fileName: "Pillar 1.docx",
      fileBase64: "UEsDBA==",
    });
    await vi.waitFor(() => expect(el.querySelector(".knowledge-ok")).toBeTruthy());
    expect(el.querySelector(".knowledge-ok")?.textContent).toMatch(
      /Pillar 1 form from 2026-11-11 .*replaced the previous one/,
    );
    await vi.waitFor(() => expect(deps.listUploads).toHaveBeenCalledTimes(2));
  });

  it("shows the server's reason when an upload fails", async () => {
    const { el } = setup({
      ingest: vi.fn(async () => {
        throw new Error(
          'Form is for "Northwind Analytics" but was uploaded to "Bluefin Legal". Upload stopped.',
        );
      }),
    });
    chooseFile(el, new File(["PK"], "f.docx"));
    button(el, "Upload form").click();
    await vi.waitFor(() =>
      expect(el.querySelector(".knowledge-msg .auth-error")?.textContent).toMatch(/Upload stopped/),
    );
    expect(button(el, "Upload form").disabled).toBe(false);
  });

  it("asks the selected client's agent and shows the answer with sources", async () => {
    const { el, deps } = setup();
    const q = /** @type {HTMLInputElement} */ (el.querySelector('input[type="text"]'));
    q.value = "  Who is our ideal customer?  ";
    button(el, "Ask").click();
    await vi.waitFor(() => expect(el.querySelector(".knowledge-answer-text")).toBeTruthy());
    expect(deps.ask).toHaveBeenCalledWith({
      orgId: "org-nw",
      question: "Who is our ideal customer?",
    });
    expect(
      [...el.querySelectorAll(".knowledge-answer-text li")].map((li) => li.textContent),
    ).toEqual(["Target cold-chain firms", "Price per site"]);
    expect(el.querySelector(".knowledge-sources")?.textContent).toBe(
      "Drew on: Pillar 1, ICP refresh (2026-11-11)",
    );
  });

  it("ignores an empty question", async () => {
    const { el, deps } = setup();
    button(el, "Ask").click();
    await flush();
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("renders the answer as text, never as HTML", async () => {
    const { el } = setup({
      ask: vi.fn(async () => ({
        answer: '<img src=x onerror="alert(1)">',
        answered: true,
        hitCount: 1,
        model: "",
        provider: "",
      })),
    });
    /** @type {HTMLInputElement} */ (el.querySelector('input[type="text"]')).value = "q";
    button(el, "Ask").click();
    await vi.waitFor(() => expect(el.querySelector(".knowledge-answer-text")).toBeTruthy());
    expect(el.querySelector(".knowledge-answer img")).toBeNull();
    expect(el.querySelector(".knowledge-answer-text")?.textContent).toContain("<img");
  });

  it("shows a plain error when the agent fails", async () => {
    const { el } = setup({
      ask: vi.fn(async () => Promise.reject(new Error("The agent couldn't answer just now."))),
    });
    /** @type {HTMLInputElement} */ (el.querySelector('input[type="text"]')).value = "q";
    button(el, "Ask").click();
    await vi.waitFor(() =>
      expect(el.querySelector(".knowledge-answer .auth-error")?.textContent).toMatch(
        /couldn't answer/,
      ),
    );
  });
});

describe("uploadStates", () => {
  it("marks the newest successful upload per pillar live and older ones replaced", () => {
    const row = (/** @type {*} */ o) => ({
      id: "x",
      orgId: "o",
      clientName: "c",
      fileName: "f",
      uploadedBy: "u",
      startedAt: "",
      ...o,
    });
    expect(
      uploadStates([
        row({ status: "succeeded", pillar: "2" }),
        row({ status: "failed" }),
        row({ status: "succeeded", pillar: "1" }),
        row({ status: "processing" }),
        row({ status: "succeeded", pillar: "1" }),
      ]),
    ).toEqual(["live", "failed", "live", "processing", "replaced"]);
  });
});

describe("bulletItems", () => {
  it("splits an all-bullet answer and leaves prose alone", () => {
    expect(bulletItems("- one\n\n- two")).toEqual(["one", "two"]);
    expect(bulletItems("• a\n* b")).toEqual(["a", "b"]);
    expect(bulletItems("Not covered yet.")).toBeNull();
    expect(bulletItems("- one\nplain")).toBeNull();
  });
});

describe("panel behaviour after the local walkthrough", () => {
  it("starts on the org open in the top bar", async () => {
    const { el, deps } = setup({ activeOrgId: "org-bf" });
    await flush();
    expect(/** @type {HTMLSelectElement} */ (el.querySelector("select")).value).toBe("org-bf");
    expect(deps.listUploads).toHaveBeenCalledWith({ orgId: "org-bf" });
  });

  it("flags an unanswered question and shows it as a sentence, not a list", async () => {
    const { el } = setup({
      ask: vi.fn(async () => ({
        answer: "That hasn't been covered yet.",
        answered: false,
        hitCount: 8,
        model: "",
        provider: "",
      })),
    });
    /** @type {HTMLInputElement} */ (el.querySelector('input[type="text"]')).value = "TikTok?";
    button(el, "Ask").click();
    await vi.waitFor(() =>
      expect(el.querySelector(".knowledge-sources")?.textContent).toMatch(/Not covered/),
    );
    expect(el.querySelector("ul.knowledge-answer-text")).toBeNull();
    expect(el.querySelector(".knowledge-answer-text")?.textContent).toBe(
      "That hasn't been covered yet.",
    );
  });

  it("update() keeps the same element, adds new orgs and follows the top bar", async () => {
    const { el, deps } = setup();
    await flush();
    const panel = /** @type {*} */ (el);
    panel.update({ orgs: [...ORGS, { id: "org-new", name: "New Co" }], activeOrgId: "org-new" });
    await flush();
    expect(document.querySelector(".knowledge-admin")).toBe(el);
    const select = /** @type {HTMLSelectElement} */ (el.querySelector("select"));
    expect([...select.options].map((o) => o.textContent)).toContain("New Co");
    expect(select.value).toBe("org-new");
    expect(deps.listUploads).toHaveBeenLastCalledWith({ orgId: "org-new" });
  });

  it("does not switch client while an upload is running", async () => {
    /** @type {(v: *) => void} */
    let finish = () => {};
    const { el } = setup({ ingest: vi.fn(() => new Promise((r) => (finish = r))) });
    await flush();
    chooseFile(el, new File([new Uint8Array([0x50, 0x4b])], "f.docx"));
    button(el, "Upload form").click();
    await flush();
    const select = /** @type {HTMLSelectElement} */ (el.querySelector("select"));
    expect(select.disabled).toBe(true);
    expect(el.querySelector(".knowledge-hint")?.textContent).toMatch(/up to a minute/);
    /** @type {*} */ (el).update({ orgs: ORGS, activeOrgId: "org-bf" });
    expect(select.value).toBe("org-nw");
    finish({ pillar: "1", sessionDate: "2026-11-11", chunks: 8, replacedChunks: 0 });
    await vi.waitFor(() =>
      expect(el.querySelector(".knowledge-ok")?.textContent).toMatch(
        /now live for Northwind Analytics\.$/,
      ),
    );
    expect(select.disabled).toBe(false);
  });

  it("shows the empty state when the last org goes and recovers when one returns", () => {
    const { el } = setup();
    /** @type {*} */ (el).update({ orgs: [] });
    expect(el.textContent).toMatch(/Create an organisation first/);
    /** @type {*} */ (el).update({ orgs: ORGS });
    expect(el.querySelector("select")).toBeTruthy();
  });
});

describe("focus across re-renders", () => {
  it("puts focus back in the question box when the panel is re-attached", () => {
    const { el } = setup();
    const q = /** @type {HTMLInputElement} */ (el.querySelector('input[type="text"]'));
    q.focus();
    q.value = "half-typed";
    const slot = document.createElement("div");
    document.body.replaceChildren(slot); // what a page re-render does
    slot.appendChild(el);
    /** @type {*} */ (el).restoreFocus();
    expect(document.activeElement).toBe(q);
    expect(q.value).toBe("half-typed");
  });

  it("does not steal focus the user moved elsewhere", () => {
    const { el } = setup();
    const q = /** @type {HTMLInputElement} */ (el.querySelector('input[type="text"]'));
    const other = document.createElement("input");
    document.body.appendChild(other);
    q.focus();
    other.focus();
    /** @type {*} */ (el).restoreFocus();
    expect(document.activeElement).toBe(other);
  });
});
