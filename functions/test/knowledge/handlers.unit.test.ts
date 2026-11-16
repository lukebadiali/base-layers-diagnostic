// Callable handlers end to end against the in-memory Firestore: who may do
// what, client isolation, the client-access switch, the upload log and the
// question log.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Answerer, AnswerInput } from "../../src/knowledge/answer";
import { NOTHING_YET } from "../../src/knowledge/ask";
import {
  handleAsk,
  handleIngest,
  handleSetStatus,
  handleUploads,
  MAX_UPLOAD_BYTES,
  type Caller,
  type HandlerDeps,
} from "../../src/knowledge/handlers";
import { QUERIES_COLLECTION, UPLOADS_COLLECTION } from "../../src/knowledge/logs";
import { FakeFirestore, hashingEmbedder, stubDescriber } from "./fakes";

const b64 = (n: string) => readFileSync(join(__dirname, "fixtures", n)).toString("base64");
const admin: Caller = { uid: "u-admin", role: "admin" };
const internal: Caller = { uid: "u-int", role: "internal" };
const nwClient: Caller = { uid: "u-nw", role: "client", orgId: "org-nw" };

function stubAnswerer(): Answerer & { seen: AnswerInput[]; fail?: boolean } {
  const a = {
    model: "test-answerer",
    seen: [] as AnswerInput[],
    fail: false,
    async answer(input: AnswerInput) {
      if (a.fail) throw new Error("upstream 503");
      a.seen.push(input);
      return { answer: "- grounded answer", provider: "test-provider" };
    },
  };
  return a;
}

let fake: FakeFirestore;
let answerer: ReturnType<typeof stubAnswerer>;
let deps: HandlerDeps;
let clock = 0;

beforeEach(() => {
  fake = new FakeFirestore();
  fake.col("orgs").set("org-nw", { name: "Northwind Analytics" });
  fake.col("orgs").set("org-bf", { name: "Bluefin Legal" });
  answerer = stubAnswerer();
  clock = 0;
  deps = {
    db: fake.asFirestore(),
    embedder: hashingEmbedder(),
    describer: stubDescriber(),
    answerer,
    clientAccess: false,
    now: () => new Date(Date.UTC(2026, 10, 16, 9, 0, clock++)),
  };
});

const upload = (orgId: string, file: string, who: Caller = admin) =>
  handleIngest(deps, who, { orgId, fileName: file, fileBase64: b64(file) });

describe("handleIngest", () => {
  it("lets staff upload and logs the upload as succeeded", async () => {
    const r = await upload("org-nw", "northwind-p1-v1.docx", internal);
    expect(r).toMatchObject({ orgId: "org-nw", pillar: "1", chunks: 8 });
    const row = fake.col(UPLOADS_COLLECTION).get(r.uploadId)!;
    expect(row).toMatchObject({
      status: "succeeded",
      orgId: "org-nw",
      clientName: "Northwind Analytics",
      uploadedBy: "u-int",
      pillar: "1",
      chunks: 8,
    });
    expect(row.finishedAt).toBeTypeOf("string");
  });

  it("refuses signed-out callers and clients", async () => {
    await expect(upload("org-nw", "northwind-p1-v1.docx", null as unknown as Caller)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(upload("org-nw", "northwind-p1-v1.docx", nwClient)).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(fake.col(UPLOADS_COLLECTION).size).toBe(0);
  });

  it("rejects files that are not .docx before parsing", async () => {
    const pdf = Buffer.from("%PDF-1.7 ...").toString("base64");
    await expect(handleIngest(deps, admin, { orgId: "org-nw", fileName: "a.pdf", fileBase64: pdf })).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(handleIngest(deps, admin, { orgId: "org-nw", fileName: "a.docx", fileBase64: pdf })).rejects.toThrow(
      /not a .docx/,
    );
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x50).toString("base64");
    await expect(handleIngest(deps, admin, { orgId: "org-nw", fileName: "a.docx", fileBase64: big })).rejects.toThrow(
      /under 5 MB/,
    );
  });

  it("rejects an unknown org", async () => {
    await expect(upload("org-missing", "northwind-p1-v1.docx")).rejects.toMatchObject({ code: "not-found" });
  });

  it("stops a form uploaded to the wrong client and logs the failure", async () => {
    await expect(upload("org-bf", "northwind-p1-v1.docx")).rejects.toMatchObject({
      code: "invalid-argument",
      message: expect.stringMatching(/Northwind Analytics.*Bluefin Legal/),
    });
    const [row] = [...fake.col(UPLOADS_COLLECTION).values()];
    expect(row).toMatchObject({ status: "failed", orgId: "org-bf" });
    expect(String(row.error)).toMatch(/Upload stopped/);
  });

  it("hides internal errors from the caller but keeps them in the log", async () => {
    deps.describer = { model: "x", describe: async () => Promise.reject(new Error("OpenRouter 502 secret detail")) };
    await expect(upload("org-nw", "northwind-p1-v1.docx")).rejects.toMatchObject({
      code: "internal",
      message: expect.not.stringMatching(/secret detail/),
    });
    const [row] = [...fake.col(UPLOADS_COLLECTION).values()];
    expect(row.error).toMatch(/secret detail/);
  });
});

describe("handleAsk", () => {
  beforeEach(async () => {
    await upload("org-nw", "northwind-p1-v2.docx");
    await upload("org-bf", "bluefin-p1.docx");
  });

  it("answers staff for the chosen client, with sources, and logs the question", async () => {
    const r = await handleAsk(deps, internal, { orgId: "org-nw", question: "Who is our ideal customer?" });
    expect(r).toMatchObject({ answer: "- grounded answer", answered: true, model: "test-answerer" });
    expect(r.sources?.length).toBeGreaterThan(0);
    expect(answerer.seen[0].clientName).toBe("Northwind Analytics");
    expect(answerer.seen[0].hits.every((h) => h.text.includes("Northwind"))).toBe(true);
    const [log] = [...fake.col(QUERIES_COLLECTION).values()];
    expect(log).toMatchObject({ orgId: "org-nw", uid: "u-int", role: "internal", answered: true, pillar: null });
    expect(log.question).toBe("Who is our ideal customer?");
  });

  it("requires staff to name the client", async () => {
    await expect(handleAsk(deps, admin, { question: "q" })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("keeps clients out until client access is switched on", async () => {
    await expect(handleAsk(deps, nwClient, { question: "q" })).rejects.toMatchObject({ code: "failed-precondition" });
    expect(answerer.seen).toHaveLength(0);
  });

  it("once on, a client gets their own org only and no sources", async () => {
    deps.clientAccess = true;
    const r = await handleAsk(deps, nwClient, { question: "Who is our ideal customer?" });
    expect(r.answered).toBe(true);
    expect(r.sources).toBeUndefined();
    expect(answerer.seen[0].hits.every((h) => !h.text.includes("Bluefin"))).toBe(true);
    await expect(handleAsk(deps, nwClient, { orgId: "org-bf", question: "q" })).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(
      handleAsk(deps, { uid: "u-x", role: "client" }, { question: "q" }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("refuses unknown roles and empty questions", async () => {
    await expect(handleAsk(deps, { uid: "u", role: "" }, { orgId: "org-nw", question: "q" })).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(handleAsk(deps, admin, { orgId: "org-nw", question: "   " })).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("logs a failed answer and returns a plain error", async () => {
    answerer.fail = true;
    await expect(handleAsk(deps, admin, { orgId: "org-nw", question: "q" })).rejects.toMatchObject({ code: "internal" });
    const [log] = [...fake.col(QUERIES_COLLECTION).values()];
    expect(log).toMatchObject({ answered: false, error: "upstream 503" });
  });
});

describe("handleUploads", () => {
  it("lists newest first, optionally for one client, to staff only", async () => {
    await upload("org-nw", "northwind-p1-v1.docx");
    await upload("org-bf", "bluefin-p1.docx");
    await upload("org-nw", "northwind-p2.docx");
    const all = await handleUploads(deps, internal, {});
    expect(all.uploads.map((u) => u.fileName)).toEqual(["northwind-p2.docx", "bluefin-p1.docx", "northwind-p1-v1.docx"]);
    const nw = await handleUploads(deps, admin, { orgId: "org-nw", limit: 1 });
    expect(nw.uploads.map((u) => u.fileName)).toEqual(["northwind-p2.docx"]);
    await expect(handleUploads(deps, nwClient, {})).rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("handleSetStatus", () => {
  it("only admins archive; an archived client's agent has nothing to say", async () => {
    await upload("org-nw", "northwind-p1-v1.docx");
    await expect(handleSetStatus(deps, internal, { orgId: "org-nw", status: "archived" })).rejects.toMatchObject({
      code: "permission-denied",
    });
    const { updated } = await handleSetStatus(deps, admin, { orgId: "org-nw", status: "archived" });
    expect(updated).toBe(9); // 1 record + 8 chunks
    const r = await handleAsk(deps, admin, { orgId: "org-nw", question: "Who is our ideal customer?" });
    expect(r).toMatchObject({ answer: NOTHING_YET, answered: false });
    expect(answerer.seen).toHaveLength(0);

    await handleSetStatus(deps, admin, { orgId: "org-nw", status: "current" });
    expect((await handleAsk(deps, admin, { orgId: "org-nw", question: "ideal customer" })).answered).toBe(true);
  });
});

describe("handleAsk pillar filter", () => {
  it("says so when the pillar has no material, without calling the model", async () => {
    await upload("org-nw", "northwind-p1-v1.docx");
    const r = await handleAsk(deps, admin, { orgId: "org-nw", question: "pricing?", pillar: "10" });
    expect(r).toMatchObject({ answered: false, answer: NOTHING_YET });
    expect(answerer.seen).toHaveLength(0);
  });
});
