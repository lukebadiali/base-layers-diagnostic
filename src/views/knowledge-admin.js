// src/views/knowledge-admin.js
// @ts-check
// Client Knowledge Agent: staff preview panel on the Admin page.
//
// HIDDEN BY DEFAULT. It renders only when the build sets
// VITE_KNOWLEDGE_ADMIN=1, so production shows nothing. Clients never see it:
// the Admin route is staff-only (src/router.js) and the server refuses client
// questions until KNOWLEDGE_CLIENT_ACCESS is on.
//
// What it does (Drive "Baselayers Agent" + 27 Oct call): staff upload a
// client's Session Capture Form, see the upload log with processing status,
// and ask that client's agent a test question (staff also see which sessions
// the answer drew on; clients will not).
import { h as defaultH } from "../ui/dom.js";
import { pendingButton } from "../ui/pending-button.js";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * @param {Record<string, unknown> | undefined} [env]
 * @returns {boolean}
 */
export function knowledgeAdminEnabled(env = import.meta.env) {
  return env?.VITE_KNOWLEDGE_ADMIN === "1";
}

/**
 * Client-side check before upload; the server re-checks.
 * @param {{ name: string, size: number } | null | undefined} file
 * @returns {string | null} an error message, or null when the file is acceptable
 */
export function checkFormFile(file) {
  if (!file) return "Choose a Session Capture Form first.";
  if (!file.name.toLowerCase().endsWith(".docx")) return "Upload the form as a Word .docx file.";
  if (file.size > MAX_UPLOAD_BYTES) return "That file is over 5 MB.";
  return null;
}

/**
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
export function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const STATUS_BADGE = { succeeded: "green", failed: "red", processing: "amber" };

/**
 * @param {string} iso
 */
function when(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * @param {string} p
 */
function pillarLabel(p) {
  return p === "review" ? "Review" : `Pillar ${p}`;
}

/**
 * @typedef {import("../cloud/knowledge.js").UploadRow} UploadRow
 * @typedef {import("../cloud/knowledge.js").AskResult} AskResult
 * @typedef {{
 *   orgs: Array<{ id: string, name: string }>,
 *   ingest: (input: { orgId: string, fileName: string, fileBase64: string }) => Promise<{ pillar: string, sessionDate: string, chunks: number, replacedChunks: number }>,
 *   ask: (input: { orgId: string, question: string }) => Promise<AskResult>,
 *   listUploads: (input: { orgId?: string }) => Promise<UploadRow[]>,
 *   h?: typeof defaultH,
 * }} KnowledgeAdminDeps
 */

/**
 * @param {KnowledgeAdminDeps} deps
 * @returns {HTMLElement}
 */
export function createKnowledgeAdminPanel(deps) {
  const h = deps.h ?? defaultH;
  const root = h("section", { class: "knowledge-admin" });
  root.appendChild(
    h("h2", {}, [
      "Client knowledge agent ",
      h("span", { class: "badge amber" }, "Preview, staff only"),
    ]),
  );
  root.appendChild(
    h(
      "p",
      { class: "muted-paragraph" },
      "Upload a client's Session Capture Form and test their agent. Clients can't see any of this yet.",
    ),
  );

  const card = h("div", { class: "card" });
  root.appendChild(card);

  if (!deps.orgs.length) {
    card.appendChild(h("p", { class: "muted-paragraph" }, "Create an organisation first."));
    return root;
  }

  const select = /** @type {HTMLSelectElement} */ (
    h(
      "select",
      { "aria-label": "Client" },
      deps.orgs.map((o) => h("option", { value: o.id }, o.name)),
    )
  );
  const orgId = () => select.value;

  // ── Upload ───────────────────────────────────────────────────────────
  const fileInput = /** @type {HTMLInputElement} */ (
    h("input", {
      type: "file",
      accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "aria-label": "Session Capture Form",
    })
  );
  const uploadBtn = /** @type {HTMLButtonElement} */ (h("button", { class: "btn" }, "Upload form"));
  const uploadPending = pendingButton(uploadBtn, "Processing…");
  const uploadMsg = h("div", { class: "knowledge-msg", role: "status" });

  // ── Upload log ───────────────────────────────────────────────────────
  const log = h("div", { class: "knowledge-log" });

  async function refreshLog() {
    log.replaceChildren(h("p", { class: "muted-paragraph" }, "Loading uploads…"));
    try {
      const rows = await deps.listUploads({ orgId: orgId() });
      if (!rows.length) {
        log.replaceChildren(
          h("p", { class: "muted-paragraph" }, "No uploads for this client yet."),
        );
        return;
      }
      log.replaceChildren(
        h("table", { class: "knowledge-table" }, [
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              ["File", "Pillar", "Session date", "Status", "Uploaded"].map((t) => h("th", {}, t)),
            ),
          ),
          h(
            "tbody",
            {},
            rows.map((r) =>
              h("tr", {}, [
                h("td", {}, r.fileName),
                h("td", {}, r.pillar ? pillarLabel(r.pillar) : "—"),
                h("td", {}, r.sessionDate ?? "—"),
                h("td", {}, [
                  h("span", { class: `badge ${STATUS_BADGE[r.status] ?? "amber"}` }, r.status),
                  r.status === "failed" && r.error
                    ? h("div", { class: "knowledge-error" }, r.error)
                    : null,
                ]),
                h("td", {}, when(r.startedAt)),
              ]),
            ),
          ),
        ]),
      );
    } catch {
      log.replaceChildren(h("p", { class: "auth-error" }, "Couldn't load the upload log."));
    }
  }

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    const problem = checkFormFile(file);
    if (problem || !file) {
      uploadMsg.replaceChildren(h("div", { class: "auth-error" }, problem ?? "Choose a file."));
      return;
    }
    uploadMsg.replaceChildren();
    uploadPending.start();
    try {
      const r = await deps.ingest({
        orgId: orgId(),
        fileName: file.name,
        fileBase64: toBase64(await file.arrayBuffer()),
      });
      uploadMsg.replaceChildren(
        h(
          "div",
          { class: "knowledge-ok" },
          `${pillarLabel(r.pillar)} form from ${r.sessionDate} is now live for this client` +
            (r.replacedChunks ? " (it replaced the previous one)." : "."),
        ),
      );
      fileInput.value = "";
    } catch (err) {
      uploadMsg.replaceChildren(
        h(
          "div",
          { class: "auth-error" },
          (err && /** @type {*} */ (err).message) || "Upload failed.",
        ),
      );
    } finally {
      uploadPending.stop();
      void refreshLog();
    }
  });

  // ── Test question ────────────────────────────────────────────────────
  const question = /** @type {HTMLInputElement} */ (
    h("input", {
      type: "text",
      maxlength: "500",
      placeholder: "e.g. Who is our ideal customer now?",
      "aria-label": "Question",
    })
  );
  const askBtn = /** @type {HTMLButtonElement} */ (h("button", { class: "btn secondary" }, "Ask"));
  const askPending = pendingButton(askBtn, "Thinking…");
  const answerBox = h("div", { class: "knowledge-answer", "aria-live": "polite" });

  async function runAsk() {
    const q = question.value.trim();
    if (!q) return;
    askPending.start();
    answerBox.replaceChildren();
    try {
      const r = await deps.ask({ orgId: orgId(), question: q });
      answerBox.replaceChildren(h("div", { class: "knowledge-answer-text" }, r.answer));
      if (r.sources?.length) {
        answerBox.appendChild(
          h(
            "div",
            { class: "knowledge-sources" },
            "Drew on: " +
              r.sources
                .map(
                  (s) =>
                    `${pillarLabel(s.pillar)}, ${s.sessionName || "session"} (${s.sessionDate})`,
                )
                .join("; "),
          ),
        );
      }
    } catch (err) {
      answerBox.replaceChildren(
        h(
          "div",
          { class: "auth-error" },
          (err && /** @type {*} */ (err).message) || "The agent couldn't answer.",
        ),
      );
    } finally {
      askPending.stop();
    }
  }
  askBtn.addEventListener("click", () => void runAsk());
  question.addEventListener("keydown", (e) => {
    if (/** @type {KeyboardEvent} */ (e).key === "Enter") void runAsk();
  });

  select.addEventListener("change", () => {
    uploadMsg.replaceChildren();
    answerBox.replaceChildren();
    void refreshLog();
  });

  card.append(
    h("div", {}, [h("label", { class: "settings-form-label" }, "Client"), select]),
    h("h3", {}, "Upload a Session Capture Form"),
    h("div", { class: "row" }, [fileInput, uploadBtn]),
    uploadMsg,
    h("h3", {}, "Uploads"),
    log,
    h("h3", {}, "Test the agent"),
    h("div", { class: "row" }, [question, askBtn]),
    answerBox,
  );

  void refreshLog();
  return root;
}
