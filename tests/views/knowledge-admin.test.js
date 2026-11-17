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

/** @param {Record<string, any>} [over] partial KnowledgeAdminDeps; loosely typed so mocks need no casts */
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
    getCoverage: vi.fn(async () => ({ status: /** @type {const} */ ("none"), pillars: [] })),
    setStatus: vi.fn(async () => ({ updated: 9 })),
    isAdmin: true,
    notify: vi.fn(),
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
    // Loaded on open, again when the job starts (shows "Processing"), and after it finishes.
    await vi.waitFor(() => expect(deps.listUploads).toHaveBeenCalledTimes(3));
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

  it("runs an upload in the background: the panel stays usable and a toast reports the result", async () => {
    /** @type {(v: *) => void} */
    let finish = () => {};
    const { el, deps } = setup({ ingest: vi.fn(() => new Promise((r) => (finish = r))) });
    await flush();
    chooseFile(el, new File([new Uint8Array([0x50, 0x4b])], "f.docx"));
    button(el, "Upload form").click();
    await flush();
    const select = /** @type {HTMLSelectElement} */ (el.querySelector("select"));
    expect(select.disabled).toBe(false);
    expect(button(el, "Upload form").disabled).toBe(false);
    expect(el.querySelector(".knowledge-msg")?.textContent).toMatch(/you can carry on/);
    expect(el.querySelector(".knowledge-queue")?.textContent).toMatch(
      /Processing f\.docx for Northwind Analytics in the background/,
    );
    // Staff move to another client while it runs: the upload stays with Northwind.
    /** @type {*} */ (el).update({ orgs: ORGS, activeOrgId: "org-bf" });
    expect(select.value).toBe("org-bf");
    finish({ pillar: "1", sessionDate: "2026-11-11", chunks: 8, replacedChunks: 0 });
    await vi.waitFor(() =>
      expect(deps.notify).toHaveBeenCalledWith(
        "success",
        "Pillar 1 form from 2026-11-11 is now live for Northwind Analytics.",
      ),
    );
    expect(deps.ingest).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-nw" }));
    expect(el.querySelector(".knowledge-ok")).toBeNull(); // Bluefin is on screen now
    expect(el.querySelector(".knowledge-queue")?.textContent).toBe("");
  });

  it("queues a second form and uploads them one at a time, in order", async () => {
    /** @type {Array<(v: *) => void>} */
    const finishers = [];
    const { el, deps } = setup({ ingest: vi.fn(() => new Promise((r) => finishers.push(r))) });
    await flush();
    chooseFile(el, new File([new Uint8Array([0x50, 0x4b])], "a.docx"));
    button(el, "Upload form").click();
    await flush();
    chooseFile(el, new File([new Uint8Array([0x50, 0x4b])], "b.docx"));
    button(el, "Upload form").click();
    await flush();
    expect(deps.ingest).toHaveBeenCalledTimes(1);
    expect(el.querySelector(".knowledge-queue")?.textContent).toMatch(/a\.docx.* 1 more waiting/);
    finishers[0]({ pillar: "1", sessionDate: "2026-11-11", chunks: 8, replacedChunks: 0 });
    await vi.waitFor(() => expect(deps.ingest).toHaveBeenCalledTimes(2));
    expect(/** @type {*} */ (deps.ingest).mock.calls[1][0]).toMatchObject({ fileName: "b.docx" });
    finishers[1]({ pillar: "2", sessionDate: "2026-11-12", chunks: 8, replacedChunks: 0 });
    await vi.waitFor(() => expect(deps.notify).toHaveBeenCalledTimes(2));
  });

  it("toasts a failed background upload with the file, client and reason", async () => {
    const { el, deps } = setup({
      ingest: vi.fn(async () => {
        throw new Error("Upload stopped.");
      }),
    });
    await flush();
    chooseFile(el, new File([new Uint8Array([0x50, 0x4b])], "f.docx"));
    button(el, "Upload form").click();
    await vi.waitFor(() =>
      expect(deps.notify).toHaveBeenCalledWith(
        "error",
        "f.docx for Northwind Analytics didn't upload: Upload stopped.",
      ),
    );
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

const P1 = {
  pillar: "1",
  pillarName: "Strategy & ICP",
  status: /** @type {const} */ ("current"),
  sessionDate: "2026-11-11",
  sessionName: "Week 5 - ICP refresh",
  sourceFileName: "p1.docx",
  uploadedAt: "2026-11-16T10:43:00.000Z",
  chunkCount: 8,
};

describe("what the agent knows", () => {
  it("says so when nothing has been uploaded", async () => {
    const { el } = setup();
    await flush();
    expect(el.querySelector(".knowledge-coverage")?.textContent).toMatch(/Nothing uploaded yet/);
    expect(el.querySelector(".knowledge-status")?.textContent).toBe("");
  });

  it("lists the live form per pillar and marks the rest not covered", async () => {
    const { el, deps } = setup({
      getCoverage: vi.fn(async () => ({ status: "current", pillars: [P1] })),
    });
    await flush();
    expect(deps.getCoverage).toHaveBeenCalledWith({ orgId: "org-nw" });
    const rows = [...el.querySelectorAll(".knowledge-coverage tbody tr")];
    expect(rows).toHaveLength(10);
    expect(rows[0].textContent).toMatch(
      /Pillar 1: Strategy & ICP.*Week 5 - ICP refresh.*2026-11-11.*p1\.docx/,
    );
    expect(rows[1].textContent).toBe("Pillar 2Not covered yet");
    expect(rows[1].className).toBe("is-empty");
  });

  it("reloads coverage when the client changes", async () => {
    const { el, deps } = setup();
    const select = /** @type {HTMLSelectElement} */ (el.querySelector("select"));
    select.value = "org-bf";
    select.dispatchEvent(new Event("change"));
    await flush();
    expect(deps.getCoverage).toHaveBeenLastCalledWith({ orgId: "org-bf" });
  });

  it("admins archive after an in-place confirmation, and can cancel", async () => {
    let status = "current";
    const { el, deps } = setup({
      getCoverage: vi.fn(async () => ({ status, pillars: [{ ...P1, status }] })),
      setStatus: vi.fn(async (/** @type {*} */ i) => {
        status = i.status;
        return { updated: 9 };
      }),
    });
    await flush();
    button(el, "Archive knowledge").click();
    expect(el.querySelector(".knowledge-status")?.textContent).toMatch(
      /Switch off Northwind Analytics's agent\?/,
    );
    button(el, "Cancel").click();
    expect(button(el, "Archive knowledge")).toBeTruthy();
    expect(deps.setStatus).not.toHaveBeenCalled();

    button(el, "Archive knowledge").click();
    button(el, "Confirm archive").click();
    await vi.waitFor(() => expect(el.querySelector(".knowledge-archived")).toBeTruthy());
    expect(deps.setStatus).toHaveBeenCalledWith({ orgId: "org-nw", status: "archived" });
    expect(el.querySelector(".knowledge-archived")?.textContent).toMatch(/new uploads are blocked/);
    expect(button(el, "Upload form").disabled).toBe(true);
    expect(el.querySelector(".knowledge-coverage tbody tr")?.className).toBe("is-replaced");
  });

  it("admins restore an archived client in one click", async () => {
    let status = "archived";
    const { el, deps } = setup({
      getCoverage: vi.fn(async () => ({ status, pillars: [{ ...P1, status }] })),
      setStatus: vi.fn(async (/** @type {*} */ i) => {
        status = i.status;
        return { updated: 9 };
      }),
    });
    await flush();
    expect(button(el, "Upload form").disabled).toBe(true);
    button(el, "Restore knowledge").click();
    await vi.waitFor(() => expect(el.querySelector(".knowledge-archived")).toBeNull());
    expect(deps.setStatus).toHaveBeenCalledWith({ orgId: "org-nw", status: "current" });
    expect(button(el, "Upload form").disabled).toBe(false);
    expect(button(el, "Archive knowledge")).toBeTruthy();
  });

  it("non-admin staff see the state but no buttons", async () => {
    const { el } = setup({
      isAdmin: false,
      getCoverage: vi.fn(async () => ({
        status: "archived",
        pillars: [{ ...P1, status: "archived" }],
      })),
    });
    await flush();
    expect(el.querySelector(".knowledge-archived")).toBeTruthy();
    expect(button(el, "Restore knowledge")).toBeUndefined();
    expect(el.querySelector(".knowledge-status")?.textContent).toMatch(
      /Only an admin can archive or restore/,
    );
  });

  it("says why Upload is greyed out while the client is archived, and clears it on restore", async () => {
    let status = "archived";
    const { el } = setup({
      getCoverage: vi.fn(async () => ({ status, pillars: [{ ...P1, status }] })),
      setStatus: vi.fn(async (/** @type {*} */ i) => {
        status = i.status;
        return { updated: 9 };
      }),
    });
    await flush();
    expect(button(el, "Upload form").disabled).toBe(true);
    expect(el.querySelector(".knowledge-blocked")?.textContent).toMatch(
      /Uploads are blocked while this client is archived/,
    );
    button(el, "Restore knowledge").click();
    await vi.waitFor(() => expect(button(el, "Upload form").disabled).toBe(false));
    expect(el.querySelector(".knowledge-blocked")?.textContent).toBe("");
  });

  it("shows the server's reason if archiving fails and keeps the button usable", async () => {
    const { el } = setup({
      getCoverage: vi.fn(async () => ({ status: "current", pillars: [P1] })),
      setStatus: vi.fn(async () => Promise.reject(new Error("Admin only"))),
    });
    await flush();
    button(el, "Archive knowledge").click();
    button(el, "Confirm archive").click();
    await vi.waitFor(() =>
      expect(el.querySelector(".knowledge-status .auth-error")?.textContent).toBe("Admin only"),
    );
    expect(button(el, "Archive knowledge").disabled).toBe(false);
  });

  it("refreshes coverage after an upload", async () => {
    const { el, deps } = setup();
    await flush();
    chooseFile(el, new File([new Uint8Array([0x50, 0x4b])], "f.docx"));
    button(el, "Upload form").click();
    await vi.waitFor(() => expect(deps.getCoverage).toHaveBeenCalledTimes(2));
  });
});

describe("archive keeps the rest of the panel honest", () => {
  it("uploadStates shows live forms as archived for an archived client", () => {
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
      uploadStates(
        [row({ status: "succeeded", pillar: "1" }), row({ status: "succeeded", pillar: "1" })],
        true,
      ),
    ).toEqual(["archived", "replaced"]);
  });

  it("clears the last upload message and relabels the log after archiving", async () => {
    let status = "current";
    const { el } = setup({
      getCoverage: vi.fn(async () => ({ status, pillars: [{ ...P1, status }] })),
      setStatus: vi.fn(async (/** @type {*} */ i) => {
        status = i.status;
        return { updated: 9 };
      }),
      listUploads: vi.fn(async () => [
        {
          id: "u1",
          orgId: "org-nw",
          clientName: "c",
          fileName: "p1.docx",
          uploadedBy: "a",
          status: "succeeded",
          pillar: "1",
          sessionDate: "2026-11-11",
          startedAt: "2026-11-16T10:43:00.000Z",
        },
      ]),
    });
    await flush();
    chooseFile(el, new File([new Uint8Array([0x50, 0x4b])], "f.docx"));
    button(el, "Upload form").click();
    await vi.waitFor(() => expect(el.querySelector(".knowledge-ok")).toBeTruthy());
    await vi.waitFor(() => expect(el.querySelector(".knowledge-log")?.textContent).toMatch(/Live/));

    button(el, "Archive knowledge").click();
    button(el, "Confirm archive").click();
    await vi.waitFor(() => expect(el.querySelector(".knowledge-archived")).toBeTruthy());
    await vi.waitFor(() =>
      expect(el.querySelector(".knowledge-log")?.textContent).toMatch(/Archived/),
    );
    expect(el.querySelector(".knowledge-ok")).toBeNull();
    expect(el.querySelector(".knowledge-log")?.textContent).not.toMatch(/Live/);
  });
});
