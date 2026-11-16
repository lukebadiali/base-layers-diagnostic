// src/views/knowledge-admin.js
// @ts-check
// Client Knowledge Agent: staff preview panel on the Admin page.
//
// HIDDEN BY DEFAULT. It renders only when the build sets
// VITE_KNOWLEDGE_ADMIN=1, so production shows nothing. Clients never see it:
// the Admin route is staff-only (src/router.js) and the server refuses client
// questions until knowledgeConfig/access { clientAccess: true } is set.
//
// What it does (Drive "Baselayers Agent" + 27 Oct call): staff upload a
// client's Session Capture Form, see the upload log with processing status,
// and ask that client's agent a test question (staff also see which sessions
// the answer drew on; clients will not).
//
// ONE INSTANCE PER PAGE LIFE. The Admin page re-renders on unrelated state
// changes (token refresh, org created). Rebuilding the panel then would drop an
// upload in progress and its result, so main.js creates it once and calls
// update() on each render instead.
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

/**
 * @typedef {import("../cloud/knowledge.js").UploadRow} UploadRow
 * @typedef {import("../cloud/knowledge.js").AskResult} AskResult
 * @typedef {"live" | "replaced" | "failed" | "processing"} RowState
 */

/**
 * Which upload is live. One form per client per pillar: the newest successful
 * upload for a pillar is live, older successful ones were replaced by it.
 * Rows arrive newest first.
 * @param {UploadRow[]} rows
 * @returns {RowState[]}
 */
export function uploadStates(rows) {
  const seen = new Set();
  return rows.map((r) => {
    if (r.status !== "succeeded") return r.status;
    const key = r.pillar ?? "";
    if (seen.has(key)) return "replaced";
    seen.add(key);
    return "live";
  });
}

/**
 * Split an answer into bullet items when every non-empty line is a "- " bullet;
 * otherwise null (render as a paragraph).
 * @param {string} answer
 * @returns {string[] | null}
 */
export function bulletItems(answer) {
  const lines = answer
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length || !lines.every((l) => /^[-•*]\s+/.test(l))) return null;
  return lines.map((l) => l.replace(/^[-•*]\s+/, ""));
}

const STATE_BADGE = { live: "green", replaced: "", failed: "red", processing: "amber" };
const STATE_LABEL = {
  live: "Live",
  replaced: "Replaced",
  failed: "Failed",
  processing: "Processing",
};

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
 * @typedef {{ id: string, name: string }} OrgOption
 * @typedef {{
 *   orgs: OrgOption[],
 *   activeOrgId?: string | null,
 *   ingest: (input: { orgId: string, fileName: string, fileBase64: string }) => Promise<{ pillar: string, sessionDate: string, chunks: number, replacedChunks: number }>,
 *   ask: (input: { orgId: string, question: string }) => Promise<AskResult>,
 *   listUploads: (input: { orgId?: string }) => Promise<UploadRow[]>,
 *   h?: typeof defaultH,
 * }} KnowledgeAdminDeps
 * @typedef {HTMLElement & {
 *   update: (next: { orgs: OrgOption[], activeOrgId?: string | null }) => void,
 *   restoreFocus: () => void,
 * }} KnowledgeAdminPanel
 */

/**
 * @param {KnowledgeAdminDeps} deps
 * @returns {KnowledgeAdminPanel}
 */
export function createKnowledgeAdminPanel(deps) {
  const h = deps.h ?? defaultH;
  const root = /** @type {KnowledgeAdminPanel} */ (h("section", { class: "knowledge-admin" }));
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

  let busy = false;
  /** @type {string | null | undefined} */
  let lastActive;

  const select = /** @type {HTMLSelectElement} */ (
    h("select", { id: "knowledge-client", class: "knowledge-select" })
  );
  const orgId = () => select.value;

  // ── Upload ───────────────────────────────────────────────────────────
  const fileInput = /** @type {HTMLInputElement} */ (
    h("input", {
      type: "file",
      class: "knowledge-file",
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
    const forOrg = orgId();
    if (!forOrg) return;
    log.replaceChildren(h("p", { class: "muted-paragraph" }, "Loading uploads…"));
    try {
      const rows = await deps.listUploads({ orgId: forOrg });
      if (forOrg !== orgId()) return; // the client changed while loading
      if (!rows.length) {
        log.replaceChildren(
          h("p", { class: "muted-paragraph" }, "No uploads for this client yet."),
        );
        return;
      }
      const states = uploadStates(rows);
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
            rows.map((r, i) =>
              h("tr", { class: states[i] === "replaced" ? "is-replaced" : "" }, [
                h("td", {}, r.fileName),
                h("td", {}, r.pillar ? pillarLabel(r.pillar) : "—"),
                h("td", {}, r.sessionDate ?? "—"),
                h("td", {}, [
                  h("span", { class: `badge ${STATE_BADGE[states[i]]}` }, STATE_LABEL[states[i]]),
                  states[i] === "failed" && r.error
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
    const forOrg = orgId();
    const forName = select.selectedOptions[0]?.textContent ?? "";
    busy = true;
    select.disabled = true;
    uploadMsg.replaceChildren(
      h(
        "div",
        { class: "knowledge-hint" },
        `Reading and tagging the form for ${forName}. This can take up to a minute.`,
      ),
    );
    uploadPending.start();
    try {
      const r = await deps.ingest({
        orgId: forOrg,
        fileName: file.name,
        fileBase64: toBase64(await file.arrayBuffer()),
      });
      uploadMsg.replaceChildren(
        h(
          "div",
          { class: "knowledge-ok" },
          `${pillarLabel(r.pillar)} form from ${r.sessionDate} is now live for ${forName}` +
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
      busy = false;
      select.disabled = false;
      uploadPending.stop();
      void refreshLog();
    }
  });

  // ── Test question ────────────────────────────────────────────────────
  const question = /** @type {HTMLInputElement} */ (
    h("input", {
      type: "text",
      class: "knowledge-question",
      maxlength: "500",
      placeholder: "e.g. Who is our ideal customer now?",
      "aria-label": "Question",
    })
  );
  const askBtn = /** @type {HTMLButtonElement} */ (h("button", { class: "btn secondary" }, "Ask"));
  const askPending = pendingButton(askBtn, "Thinking…");
  const answerBox = h("div", { class: "knowledge-answer", "aria-live": "polite" });

  /** @param {AskResult} r */
  function renderAnswer(r) {
    const items = bulletItems(r.answer);
    const body = items
      ? h(
          "ul",
          { class: "knowledge-answer-text" },
          items.map((t) => h("li", {}, t)),
        )
      : h("div", { class: "knowledge-answer-text" }, r.answer);
    answerBox.replaceChildren(body);
    if (!r.answered) {
      answerBox.appendChild(
        h(
          "div",
          { class: "knowledge-sources" },
          "Not covered by this client's delivered material. Logged as unanswered.",
        ),
      );
    } else if (r.sources?.length) {
      answerBox.appendChild(
        h(
          "div",
          { class: "knowledge-sources" },
          "Drew on: " +
            r.sources
              .map(
                (s) => `${pillarLabel(s.pillar)}, ${s.sessionName || "session"} (${s.sessionDate})`,
              )
              .join("; "),
        ),
      );
    }
  }

  async function runAsk() {
    const q = question.value.trim();
    if (!q) return;
    askPending.start();
    answerBox.replaceChildren();
    try {
      renderAnswer(await deps.ask({ orgId: orgId(), question: q }));
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

  const empty = h("p", { class: "muted-paragraph" }, "Create an organisation first.");
  const body = h("div", {}, [
    h("div", { class: "knowledge-field" }, [
      h("label", { class: "settings-form-label", for: "knowledge-client" }, "Client"),
      select,
    ]),
    h("h3", {}, "Upload a Session Capture Form"),
    h("div", { class: "row" }, [fileInput, uploadBtn]),
    uploadMsg,
    h("h3", {}, "Uploads"),
    log,
    h("h3", {}, "Test the agent"),
    h("div", { class: "row" }, [question, askBtn]),
    answerBox,
  ]);

  /**
   * Refresh the client list and follow the org open in the top bar, without
   * rebuilding the panel. Never switches client while an upload is running.
   * @param {{ orgs: OrgOption[], activeOrgId?: string | null }} next
   */
  root.update = (next) => {
    if (!next.orgs.length) {
      card.replaceChildren(empty);
      return;
    }
    if (!card.contains(body)) card.replaceChildren(body);

    const prev = select.value;
    const ids = next.orgs.map((o) => o.id).join("|");
    if (ids !== [...select.options].map((o) => o.value).join("|")) {
      select.replaceChildren(...next.orgs.map((o) => h("option", { value: o.id }, o.name)));
    } else {
      next.orgs.forEach((o, i) => {
        if (select.options[i].textContent !== o.name) select.options[i].textContent = o.name;
      });
    }

    const activeChanged = next.activeOrgId !== lastActive;
    lastActive = next.activeOrgId;
    let want = prev;
    if (
      !busy &&
      activeChanged &&
      next.activeOrgId &&
      next.orgs.some((o) => o.id === next.activeOrgId)
    ) {
      want = next.activeOrgId;
    }
    if (!next.orgs.some((o) => o.id === want)) want = next.orgs[0].id;
    select.value = want;
    if (want !== prev) {
      uploadMsg.replaceChildren();
      answerBox.replaceChildren();
      void refreshLog();
    }
  };

  // Focus survives a re-render: re-attaching the panel drops focus to <body>,
  // which would throw staff out of the question box mid-typing. Remember the
  // last control focused here; forget it when the user moves focus elsewhere.
  /** @type {HTMLElement | null} */
  let lastFocus = null;
  root.addEventListener("focusin", (e) => {
    lastFocus = /** @type {HTMLElement} */ (e.target);
  });
  root.addEventListener("focusout", (e) => {
    const to = /** @type {FocusEvent} */ (e).relatedTarget;
    if (to && !root.contains(/** @type {Node} */ (to))) lastFocus = null;
  });
  root.restoreFocus = () => {
    const active = document.activeElement;
    if (lastFocus && root.contains(lastFocus) && (!active || active === document.body)) {
      lastFocus.focus({ preventScroll: true });
    }
  };

  root.update({ orgs: deps.orgs, activeOrgId: deps.activeOrgId });
  return root;
}
