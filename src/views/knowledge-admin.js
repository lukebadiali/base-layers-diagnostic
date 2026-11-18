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
import { notify as defaultNotify } from "../ui/toast.js";

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
 * @typedef {import("../cloud/knowledge.js").OrgCoverage} OrgCoverage
 * @typedef {"live" | "archived" | "replaced" | "failed" | "processing"} RowState
 */

/**
 * Which upload is live. One form per client per pillar: the newest successful
 * upload for a pillar is live, older successful ones were replaced by it.
 * Rows arrive newest first.
 * @param {UploadRow[]} rows
 * @param {boolean} [archived] the client's knowledge is archived: its live forms show as archived
 * @returns {RowState[]}
 */
export function uploadStates(rows, archived = false) {
  const seen = new Set();
  return rows.map((r) => {
    if (r.status !== "succeeded") return r.status;
    const key = `${r.orgId}|${r.pillar ?? ""}`;
    if (seen.has(key)) return "replaced";
    seen.add(key);
    return archived ? "archived" : "live";
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

const STATE_BADGE = {
  live: "green",
  archived: "",
  replaced: "",
  failed: "red",
  processing: "amber",
};
const STATE_LABEL = {
  live: "Live",
  archived: "Archived",
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
 *   ask: (input: { orgId?: string, question: string, scope?: "client" | "all" }) => Promise<AskResult>,
 *   listUploads: (input: { orgId?: string }) => Promise<UploadRow[]>,
 *   getCoverage: (input: { orgId: string }) => Promise<OrgCoverage>,
 *   setStatus: (input: { orgId: string, status: "current" | "archived" }) => Promise<{ updated: number }>,
 *   isAdmin?: boolean,
 *   notify?: (level: "info" | "success" | "warn" | "error", message: string) => void,
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
    h("p", { class: "muted-paragraph" }, [
      h("span", { class: "badge amber" }, "Staff only"),
      " Upload Session Capture Forms, follow each upload, see what each client's agent knows and test it.",
    ]),
  );

  const card = h("div", { class: "card" });
  root.appendChild(card);

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
      multiple: "",
      "aria-label": "Session Capture Form",
    })
  );
  const uploadBtn = /** @type {HTMLButtonElement} */ (h("button", { class: "btn" }, "Upload form"));
  const jobsBox = h("div", { class: "knowledge-jobs" });
  const uploadMsg = h("div", { class: "knowledge-msg", role: "status" });
  const uploadBlocked = h("div", { class: "knowledge-hint knowledge-blocked" });

  // ── Upload log ───────────────────────────────────────────────────────
  const log = h("div", { class: "knowledge-log" });
  const logScope = /** @type {HTMLSelectElement} */ (
    h(
      "select",
      { class: "knowledge-select knowledge-log-scope", "aria-label": "Upload history for" },
      [
        h("option", { value: "client" }, "This client"),
        h("option", { value: "all" }, "All clients"),
      ],
    )
  );
  /** @type {ReturnType<typeof setTimeout> | null} */
  let logPoll = null;

  // ── What the agent knows ─────────────────────────────────────────────
  const coverageBox = h("div", { class: "knowledge-coverage" });
  const statusBox = h("div", { class: "knowledge-status" });
  /** @type {OrgCoverage["status"] | null} */
  let coverageStatus = null;

  async function refreshCoverage() {
    const forOrg = orgId();
    if (!forOrg) return;
    coverageBox.replaceChildren(h("p", { class: "muted-paragraph" }, "Loading…"));
    statusBox.replaceChildren();
    try {
      const c = await deps.getCoverage({ orgId: forOrg });
      if (forOrg !== orgId()) return;
      coverageStatus = c.status;
      uploadBtn.disabled = c.status === "archived";
      uploadBlocked.replaceChildren(
        c.status === "archived"
          ? "Uploads are blocked while this client is archived. Restore knowledge to upload again."
          : "",
      );
      renderCoverage(c);
      renderStatus(c);
    } catch {
      coverageBox.replaceChildren(
        h("p", { class: "auth-error" }, "Couldn't load what the agent knows."),
      );
    }
  }

  /** @param {OrgCoverage} c */
  function renderCoverage(c) {
    if (c.status === "none") {
      coverageBox.replaceChildren(
        h(
          "p",
          { class: "muted-paragraph" },
          "Nothing uploaded yet. The agent will tell this client there's no delivered material.",
        ),
      );
      return;
    }
    const byPillar = new Map(c.pillars.map((p) => [p.pillar, p]));
    const keys = [
      ...(byPillar.has("review") ? ["review"] : []),
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ];
    coverageBox.replaceChildren(
      h("table", { class: "knowledge-table" }, [
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            ["Pillar", "Session", "Session date", "From file", "Uploaded"].map((t) =>
              h("th", {}, t),
            ),
          ),
        ),
        h(
          "tbody",
          {},
          keys.map((k) => {
            const p = byPillar.get(k);
            if (!p) {
              return h("tr", { class: "is-empty" }, [
                h("td", {}, pillarLabel(k)),
                h("td", { colspan: "4" }, "Not covered yet"),
              ]);
            }
            return h("tr", { class: p.status === "archived" ? "is-replaced" : "" }, [
              h("td", {}, p.pillarName ? `${pillarLabel(k)}: ${p.pillarName}` : pillarLabel(k)),
              h("td", {}, p.sessionName || "—"),
              h("td", {}, p.sessionDate || "—"),
              h("td", {}, p.sourceFileName || "—"),
              h("td", {}, p.uploadedAt ? when(p.uploadedAt) : "—"),
            ]);
          }),
        ),
      ]),
    );
  }

  /** @param {OrgCoverage} c */
  function renderStatus(c) {
    statusBox.replaceChildren();
    if (c.status === "none") return;
    const name = select.selectedOptions[0]?.textContent ?? "this client";
    const archived = c.status === "archived";
    if (archived) {
      statusBox.appendChild(
        h(
          "div",
          { class: "knowledge-archived" },
          `Archived. ${name}'s agent answers nothing until this is restored, and new uploads are blocked.`,
        ),
      );
    }
    if (!deps.isAdmin) {
      statusBox.appendChild(
        h(
          "p",
          { class: "knowledge-hint" },
          "Only an admin can archive or restore a client's knowledge.",
        ),
      );
      return;
    }
    const action = /** @type {HTMLButtonElement} */ (
      h(
        "button",
        { class: "btn secondary sm" },
        archived ? "Restore knowledge" : "Archive knowledge",
      )
    );
    const row = h("div", { class: "row" }, [action]);
    statusBox.appendChild(row);
    const run = async () => {
      const pending = pendingButton(action, archived ? "Restoring…" : "Archiving…");
      pending.start();
      try {
        await deps.setStatus({ orgId: orgId(), status: archived ? "current" : "archived" });
      } catch (err) {
        statusBox.appendChild(
          h(
            "div",
            { class: "auth-error" },
            (err && /** @type {*} */ (err).message) || "That didn't work.",
          ),
        );
        pending.stop();
        return;
      }
      uploadMsg.replaceChildren();
      void refreshAll();
    };
    if (archived) {
      action.addEventListener("click", () => void run());
      return;
    }
    // Archiving switches the agent off for the client: confirm in place first.
    action.addEventListener("click", () => {
      const confirmBtn = /** @type {HTMLButtonElement} */ (
        h("button", { class: "btn ghost danger sm" }, "Confirm archive")
      );
      const cancelBtn = h("button", { class: "btn secondary sm" }, "Cancel");
      confirmBtn.addEventListener("click", () => {
        row.replaceChildren(action);
        void run();
      });
      cancelBtn.addEventListener("click", () => row.replaceChildren(action));
      row.replaceChildren(
        h(
          "span",
          { class: "knowledge-hint" },
          `Switch off ${name}'s agent? It can be restored later.`,
        ),
        confirmBtn,
        cancelBtn,
      );
    });
  }

  /** Coverage first: the upload log labels live forms "Archived" when the client is archived. */
  async function refreshAll() {
    await refreshCoverage();
    await refreshLog();
  }

  async function refreshLog() {
    const forOrg = orgId();
    if (!forOrg) return;
    const all = logScope.value === "all";
    if (logPoll) clearTimeout(logPoll);
    logPoll = null;
    if (!log.querySelector("table")) {
      log.replaceChildren(h("p", { class: "muted-paragraph" }, "Loading uploads…"));
    }
    try {
      const rows = await deps.listUploads(all ? {} : { orgId: forOrg });
      if (forOrg !== orgId() || all !== (logScope.value === "all")) return; // changed while loading
      if (!rows.length) {
        log.replaceChildren(
          h(
            "p",
            { class: "muted-paragraph" },
            all ? "No uploads yet." : "No uploads for this client yet.",
          ),
        );
        return;
      }
      const states = uploadStates(rows, !all && coverageStatus === "archived");
      const head = all
        ? ["File", "Client", "Pillar", "Session date", "Status", "Uploaded"]
        : ["File", "Pillar", "Session date", "Status", "Uploaded"];
      log.replaceChildren(
        h("table", { class: "knowledge-table" }, [
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              head.map((t) => h("th", {}, t)),
            ),
          ),
          h(
            "tbody",
            {},
            rows.map((r, i) =>
              h("tr", { class: states[i] === "replaced" ? "is-replaced" : "" }, [
                h("td", {}, r.fileName),
                all ? h("td", {}, r.clientName || "—") : null,
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
      // Anything still processing (here or on another staff member's screen):
      // look again shortly, so the history settles on its own.
      if (rows.some((r) => r.status === "processing")) {
        logPoll = setTimeout(() => void refreshLog(), 5000);
      }
    } catch {
      log.replaceChildren(h("p", { class: "auth-error" }, "Couldn't load the upload log."));
    }
  }
  logScope.addEventListener("change", () => void refreshLog());

  // ── Upload jobs ──────────────────────────────────────────────────────
  // Uploads run in the background, one at a time, in the order chosen. Staff
  // can carry on (another client, another tab of the app) while a form is
  // read and tagged; the jobs list shows each one's progress and a toast says
  // when each is live or failed. One at a time, so two forms for the same
  // pillar never race.
  /**
   * @typedef {{ id: number, orgId: string, name: string, fileName: string, fileBase64: string,
   *   status: "queued" | "processing" | "live" | "failed" | "cancelled",
   *   started?: number, finished?: number, message?: string }} Job
   */
  /** @type {Job[]} */
  const jobs = [];
  let nextJobId = 1;
  let draining = false;
  /** @type {ReturnType<typeof setInterval> | null} */
  let ticker = null;
  const queueLine = h("div", { class: "knowledge-hint knowledge-queue", role: "status" });

  const JOB_BADGE = {
    queued: "",
    processing: "amber",
    live: "green",
    failed: "red",
    cancelled: "",
  };
  const JOB_LABEL = {
    queued: "Queued",
    processing: "Processing",
    live: "Live",
    failed: "Failed",
    cancelled: "Cancelled",
  };

  /** @param {number} ms */
  const secs = (ms) => `${Math.max(0, Math.round(ms / 1000))}s`;

  function renderQueue() {
    const current = jobs.find((j) => j.status === "processing");
    const waiting = jobs.filter((j) => j.status === "queued").length;
    if (!current) {
      queueLine.replaceChildren();
      return;
    }
    queueLine.replaceChildren(
      `Processing ${current.fileName} for ${current.name} in the background.` +
        (waiting ? ` ${waiting} more waiting.` : ""),
    );
  }

  function renderJobs() {
    renderQueue();
    if (!jobs.length) {
      jobsBox.replaceChildren(
        h("p", { class: "muted-paragraph" }, "No uploads started in this session."),
      );
      return;
    }
    const now = Date.now();
    const finished = jobs.some((j) => ["live", "failed", "cancelled"].includes(j.status));
    const kids = /** @type {Node[]} */ (
      [
        h("table", { class: "knowledge-table" }, [
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              ["File", "Client", "Status", "Time", ""].map((t) => h("th", {}, t)),
            ),
          ),
          h(
            "tbody",
            {},
            jobs.map((j) => {
              const time =
                j.status === "processing" && j.started
                  ? secs(now - j.started)
                  : j.started && j.finished
                    ? secs(j.finished - j.started)
                    : "—";
              /** @type {HTMLButtonElement | null} */
              let action = null;
              if (j.status === "queued") {
                action = /** @type {HTMLButtonElement} */ (
                  h("button", { class: "btn ghost sm" }, "Cancel")
                );
                action.addEventListener("click", () => {
                  j.status = "cancelled";
                  renderJobs();
                });
              } else if (j.status === "failed" && j.fileBase64) {
                action = /** @type {HTMLButtonElement} */ (
                  h("button", { class: "btn secondary sm" }, "Retry")
                );
                action.addEventListener("click", () => {
                  j.status = "queued";
                  j.message = undefined;
                  j.started = j.finished = undefined;
                  renderJobs();
                  void drain();
                });
              }
              return h("tr", { "data-job": String(j.id) }, [
                h("td", {}, j.fileName),
                h("td", {}, j.name),
                h("td", {}, [
                  h("span", { class: `badge ${JOB_BADGE[j.status]}` }, JOB_LABEL[j.status]),
                  j.message
                    ? h(
                        "div",
                        { class: j.status === "failed" ? "knowledge-error" : "knowledge-hint" },
                        j.message,
                      )
                    : null,
                ]),
                h("td", {}, time),
                h("td", {}, action),
              ]);
            }),
          ),
        ]),
        finished
          ? (() => {
              const clear = /** @type {HTMLButtonElement} */ (
                h("button", { class: "btn ghost sm" }, "Clear finished")
              );
              clear.addEventListener("click", () => {
                for (let i = jobs.length - 1; i >= 0; i--) {
                  if (["live", "failed", "cancelled"].includes(jobs[i].status)) jobs.splice(i, 1);
                }
                renderJobs();
              });
              return h("div", { class: "row" }, [clear]);
            })()
          : null,
      ].filter(Boolean)
    );
    jobsBox.replaceChildren(...kids);
  }

  /** @param {string} level @param {string} message */
  const toast = (level, message) =>
    (deps.notify ?? defaultNotify)(/** @type {*} */ (level), message);

  async function drain() {
    if (draining) return;
    draining = true;
    ticker ??= setInterval(renderJobs, 1000);
    try {
      for (;;) {
        const job = jobs.find((j) => j.status === "queued");
        if (!job) break;
        job.status = "processing";
        job.started = Date.now();
        renderJobs();
        if (job.orgId === orgId()) void refreshLog();
        try {
          const r = await deps.ingest({
            orgId: job.orgId,
            fileName: job.fileName,
            fileBase64: job.fileBase64,
          });
          const text =
            `${pillarLabel(r.pillar)} form from ${r.sessionDate} is now live for ${job.name}` +
            (r.replacedChunks ? " (it replaced the previous one)." : ".");
          job.status = "live";
          job.message = text;
          job.fileBase64 = ""; // done with it; frees memory
          toast("success", text);
          if (job.orgId === orgId()) {
            uploadMsg.replaceChildren(h("div", { class: "knowledge-ok" }, text));
          }
        } catch (err) {
          const reason = (err && /** @type {*} */ (err).message) || "Upload failed.";
          job.status = "failed";
          job.message = reason;
          toast("error", `${job.fileName} for ${job.name} didn't upload: ${reason}`);
          if (job.orgId === orgId()) {
            uploadMsg.replaceChildren(h("div", { class: "auth-error" }, reason));
          }
        }
        job.finished = Date.now();
        renderJobs();
        if (job.orgId === orgId()) void refreshAll();
      }
    } finally {
      draining = false;
      if (ticker) clearInterval(ticker);
      ticker = null;
      renderJobs();
    }
  }

  // Closing the tab drops forms not yet sent, so ask first while any are pending.
  window.addEventListener("beforeunload", (e) => {
    if (jobs.some((j) => j.status === "queued" || j.status === "processing")) e.preventDefault();
  });

  uploadBtn.addEventListener("click", async () => {
    const files = [...(fileInput.files ?? [])];
    if (!files.length) {
      uploadMsg.replaceChildren(
        h("div", { class: "auth-error" }, checkFormFile(undefined) ?? "Choose a file."),
      );
      return;
    }
    const forOrg = orgId();
    const name = select.selectedOptions[0]?.textContent ?? "";
    /** @type {string[]} */
    const rejected = [];
    let added = 0;
    for (const file of files) {
      const problem = checkFormFile(file);
      if (problem) {
        rejected.push(`${file.name}: ${problem}`);
        continue;
      }
      jobs.push({
        id: nextJobId++,
        orgId: forOrg,
        name,
        fileName: file.name,
        fileBase64: toBase64(await file.arrayBuffer()),
        status: "queued",
      });
      added++;
    }
    fileInput.value = "";
    if (rejected.length && !added) {
      uploadMsg.replaceChildren(
        h(
          "div",
          { class: "auth-error" },
          files.length === 1 ? (checkFormFile(files[0]) ?? "") : rejected.join(" "),
        ),
      );
      return;
    }
    const what =
      added === 1
        ? `${jobs[jobs.length - 1].fileName} is uploading`
        : `${added} forms are uploading`;
    uploadMsg.replaceChildren(
      h(
        "div",
        { class: "knowledge-hint" },
        `${what} for ${name}. Each takes up to a minute; you can carry on and you'll get a notification when it's live.` +
          (rejected.length ? ` Skipped: ${rejected.join(" ")}` : ""),
      ),
    );
    renderJobs();
    void drain();
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
  // Staff only (the server refuses it to anyone else): one question across
  // every client with live knowledge. Each point names its client.
  const allClients = /** @type {HTMLInputElement} */ (
    h("input", { type: "checkbox", id: "knowledge-all-clients" })
  );
  allClients.addEventListener("change", () => {
    question.placeholder = allClients.checked
      ? "e.g. Which clients target founder-led businesses?"
      : "e.g. Who is our ideal customer now?";
    answerBox.replaceChildren();
  });

  /** @param {AskResult & { scope?: "client" | "all" }} r */
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
          r.scope === "all"
            ? "Not covered by any client's delivered material. Logged as unanswered."
            : "Not covered by this client's delivered material. Logged as unanswered.",
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
                (s) =>
                  (s.clientName ? `${s.clientName}: ` : "") +
                  `${pillarLabel(s.pillar)}, ${s.sessionName || "session"} (${s.sessionDate})`,
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
      const all = allClients.checked;
      const r = await deps.ask(
        all ? { scope: "all", question: q } : { orgId: orgId(), question: q },
      );
      renderAnswer({ ...r, scope: all ? "all" : "client" });
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
    void refreshAll();
  });

  const empty = h("p", { class: "muted-paragraph" }, "Create an organisation first.");
  const body = h("div", {}, [
    h("div", { class: "knowledge-field" }, [
      h("label", { class: "settings-form-label", for: "knowledge-client" }, "Client"),
      select,
    ]),
    h("h3", {}, "Upload Session Capture Forms"),
    h("div", { class: "row" }, [fileInput, uploadBtn]),
    uploadBlocked,
    queueLine,
    uploadMsg,
    h("h3", {}, "Upload jobs"),
    jobsBox,
    h("h3", {}, "What the agent knows"),
    coverageBox,
    statusBox,
    h("div", { class: "row knowledge-log-head" }, [h("h3", {}, "Upload history"), logScope]),
    log,
    h("h3", {}, "Test the agent"),
    h("div", { class: "row" }, [question, askBtn]),
    h("label", { class: "knowledge-scope", for: "knowledge-all-clients" }, [
      allClients,
      " Ask across all clients (staff only; each point names its client)",
    ]),
    answerBox,
  ]);

  /**
   * Refresh the client list and follow the org open in the top bar, without
   * rebuilding the panel. Uploads keep running for the client they were started for.
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
    if (activeChanged && next.activeOrgId && next.orgs.some((o) => o.id === next.activeOrgId)) {
      want = next.activeOrgId;
    }
    if (!next.orgs.some((o) => o.id === want)) want = next.orgs[0].id;
    select.value = want;
    if (want !== prev) {
      uploadMsg.replaceChildren();
      answerBox.replaceChildren();
      void refreshAll();
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

  renderJobs();
  root.update({ orgs: deps.orgs, activeOrgId: deps.activeOrgId });
  return root;
}
