// tests/rules/storage.test.js
// @ts-check
// Phase 5 Wave 1 (RULES-05 / D-14 storage / D-17): storage.rules matrix.
// Mirrors src/ui/upload.js MAX_BYTES (25 MiB) + ALLOWED_MIME_TYPES allowlist.
// Cells: tenant scope + size cap + MIME allowlist + delete role check + path
// catch-all deny-all fallback.
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";
import { initRulesEnv, ROLES, asStorageUser, assertSucceeds, assertFails } from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

beforeAll(async () => {
  testEnv = await initRulesEnv("storage", "storage-matrix");
  // Pre-seed an existing object for read/delete tests.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = ctx.storage();
    const r = ref(s, "orgs/orgA/documents/d1/foo.pdf");
    const seedBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    await uploadBytes(r, seedBytes, { contentType: "application/pdf" });
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

function smallPayload() {
  return new Uint8Array(1024 * 1024); // 1 MiB
}
function oversizedPayload() {
  return new Uint8Array(26 * 1024 * 1024); // 26 MiB > 25 MiB cap
}

describe("storage.rules - read access (tenant scope)", () => {
  it("anonymous denies read", async () => {
    const s = asStorageUser(testEnv, "anonymous", {});
    const r = ref(s, "orgs/orgA/documents/d1/foo.pdf");
    await assertFails(getDownloadURL(r));
  });
  it("client_orgA reads their own org's document (allow)", async () => {
    const s = asStorageUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    const r = ref(s, "orgs/orgA/documents/d1/foo.pdf");
    await assertSucceeds(getDownloadURL(r));
  });
  it("client_orgB denied reading orgA's document (cross-tenant)", async () => {
    const s = asStorageUser(testEnv, "client_orgB", claimsByRole.client_orgB);
    const r = ref(s, "orgs/orgA/documents/d1/foo.pdf");
    await assertFails(getDownloadURL(r));
  });
  it("internal can read any org document", async () => {
    const s = asStorageUser(testEnv, "internal", claimsByRole.internal);
    const r = ref(s, "orgs/orgA/documents/d1/foo.pdf");
    await assertSucceeds(getDownloadURL(r));
  });
});

describe("storage.rules - upload (validSize + validMime + tenant)", () => {
  it("client_orgA uploads 1 MiB application/pdf (allow)", async () => {
    const s = asStorageUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    const r = ref(s, "orgs/orgA/documents/d2/foo.pdf");
    await assertSucceeds(
      uploadBytes(r, smallPayload(), { contentType: "application/pdf" }),
    );
  });
  it("client_orgA uploads 26 MiB application/pdf (deny - validSize)", async () => {
    const s = asStorageUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    const r = ref(s, "orgs/orgA/documents/d3/big.pdf");
    await assertFails(
      uploadBytes(r, oversizedPayload(), { contentType: "application/pdf" }),
    );
  });
  it("client_orgA uploads 1 MiB application/zip (deny - validMime)", async () => {
    const s = asStorageUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    const r = ref(s, "orgs/orgA/documents/d4/foo.zip");
    await assertFails(
      uploadBytes(r, smallPayload(), { contentType: "application/zip" }),
    );
  });
  it("client_orgA uploads to orgs/orgB/* (deny - cross-tenant)", async () => {
    const s = asStorageUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    const r = ref(s, "orgs/orgB/documents/d5/foo.pdf");
    await assertFails(
      uploadBytes(r, smallPayload(), { contentType: "application/pdf" }),
    );
  });
  it("client_orgA uploads image/jpeg (allow - allowlist member)", async () => {
    const s = asStorageUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    const r = ref(s, "orgs/orgA/documents/d6/photo.jpg");
    await assertSucceeds(
      uploadBytes(r, smallPayload(), { contentType: "image/jpeg" }),
    );
  });
  it("client_orgA uploads text/plain (allow - allowlist member)", async () => {
    const s = asStorageUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    const r = ref(s, "orgs/orgA/documents/d7/notes.txt");
    await assertSucceeds(
      uploadBytes(r, smallPayload(), { contentType: "text/plain" }),
    );
  });
});

describe("storage.rules - delete (role-gated)", () => {
  it("internal deletes orgA document (allow)", async () => {
    // Seed a fresh object for this test
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const s = ctx.storage();
      const r = ref(s, "orgs/orgA/documents/dDel1/foo.pdf");
      await uploadBytes(r, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
        contentType: "application/pdf",
      });
    });
    const s = asStorageUser(testEnv, "internal", claimsByRole.internal);
    const r = ref(s, "orgs/orgA/documents/dDel1/foo.pdf");
    await assertSucceeds(deleteObject(r));
  });
  it("client_orgA cannot delete (deny)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const s = ctx.storage();
      const r = ref(s, "orgs/orgA/documents/dDel2/foo.pdf");
      await uploadBytes(r, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
        contentType: "application/pdf",
      });
    });
    const s = asStorageUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    const r = ref(s, "orgs/orgA/documents/dDel2/foo.pdf");
    await assertFails(deleteObject(r));
  });
});

describe("storage.rules - global deny-all fallback (defense-in-depth)", () => {
  it("client_orgA cannot read random/path/foo.pdf (catch-all deny)", async () => {
    const s = asStorageUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    const r = ref(s, "random/path/foo.pdf");
    await assertFails(getDownloadURL(r));
  });
  it("client_orgA cannot upload outside orgs/{orgId}/documents/{docId}/{filename}", async () => {
    const s = asStorageUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    const r = ref(s, "scratch/foo.pdf");
    await assertFails(
      uploadBytes(r, smallPayload(), { contentType: "application/pdf" }),
    );
  });
});
