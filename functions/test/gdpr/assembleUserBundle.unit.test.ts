// Phase 8 Wave 3 (GDPR-01): pure unit tests for assembleUserBundle.ts.
// No vi.mock needed — the helper has zero Admin SDK imports (Pattern C purity).
// Tests cover the 5 behaviors specified in 08-04-PLAN.md Task 1.

import { describe, it, expect } from "vitest";
import {
  assembleUserBundle,
  BUNDLE_SCHEMA_VERSION,
  DOCUMENT_AUTHOR_FIELDS,
} from "../../src/gdpr/assembleUserBundle.js";
import type { QueryResults } from "../../src/gdpr/assembleUserBundle.js";

const EMPTY_RESULTS: QueryResults = {
  profile: null,
  auditEvents: [],
  responses: [],
  comments: [],
  messages: [],
  actions: [],
  documents: [],
  funnelComments: [],
};

const NOW_MS = 1715340000000; // 2024-05-10T12:00:00Z — fixed for determinism
const USER_ID = "u-test-uid";

describe("assembleUserBundle — pure unit tests", () => {
  // Test 1: empty inputs → correct skeleton shape
  it("returns skeleton bundle with correct schema version and empty arrays when inputs are all empty", () => {
    const bundle = assembleUserBundle(USER_ID, EMPTY_RESULTS, NOW_MS);

    expect(bundle.bundleSchemaVersion).toBe(BUNDLE_SCHEMA_VERSION);
    expect(bundle.bundleSchemaVersion).toBe(1);
    expect(bundle.userId).toBe(USER_ID);
    expect(bundle.assembledAt).toBe(new Date(NOW_MS).toISOString());
    expect(bundle.profile).toBeNull();
    expect(bundle.auditEvents).toHaveLength(0);
    expect(bundle.responses).toHaveLength(0);
    expect(bundle.comments).toHaveLength(0);
    expect(bundle.messages).toHaveLength(0);
    expect(bundle.actions).toHaveLength(0);
    expect(bundle.documents).toHaveLength(0);
    expect(bundle.funnelComments).toHaveLength(0);
  });

  // Test 2: populated profile + messages + comments land correctly
  it("maps profile + 2 messages + 1 comment into bundle with correct lengths", () => {
    const results: QueryResults = {
      ...EMPTY_RESULTS,
      profile: { displayName: "Alice", email: "alice@example.com" },
      messages: [
        { path: "orgs/o1/messages/m1", data: { body: "hello", authorId: USER_ID } },
        { path: "orgs/o1/messages/m2", data: { body: "world", authorId: USER_ID } },
      ],
      comments: [
        { path: "orgs/o1/comments/c1", data: { text: "hi", authorId: USER_ID } },
      ],
    };

    const bundle = assembleUserBundle(USER_ID, results, NOW_MS);

    expect(bundle.profile).toEqual({ displayName: "Alice", email: "alice@example.com" });
    expect(bundle.messages).toHaveLength(2);
    expect(bundle.comments).toHaveLength(1);
    // Other arrays remain empty
    expect(bundle.responses).toHaveLength(0);
    expect(bundle.actions).toHaveLength(0);
    expect(bundle.documents).toHaveLength(0);
    expect(bundle.funnelComments).toHaveLength(0);
  });

  // Test 3: audit events filtered by actor.uid === userId (defensive re-check)
  it("filters audit events to only those where actor.uid === userId", () => {
    const results: QueryResults = {
      ...EMPTY_RESULTS,
      auditEvents: [
        { eventId: "e1", actor: { uid: USER_ID, email: "alice@example.com" }, type: "auth.signin.success" },
        { eventId: "e2", actor: { uid: "other-user", email: "other@example.com" }, type: "auth.signin.success" },
        { eventId: "e3", actor: { uid: USER_ID, email: "alice@example.com" }, type: "compliance.export.user" },
        { eventId: "e4", actor: null, type: "data.org.create" }, // null actor — excluded
      ],
    };

    const bundle = assembleUserBundle(USER_ID, results, NOW_MS);

    // Only events where actor.uid === USER_ID should appear
    expect(bundle.auditEvents).toHaveLength(2);
    expect((bundle.auditEvents[0] as Record<string, unknown>).eventId).toBe("e1");
    expect((bundle.auditEvents[1] as Record<string, unknown>).eventId).toBe("e3");
  });

  // Test 4: documents de-duplicated by path (multi-field query overlap)
  it("de-duplicates documents by path when the same doc matches multiple field queries", () => {
    // Simulate: same doc matches uploaderId query AND legacyAppUserId query
    const docEntry = { path: "orgs/o1/documents/d1", data: { uploaderId: USER_ID, legacyAppUserId: USER_ID } };
    const results: QueryResults = {
      ...EMPTY_RESULTS,
      documents: [
        docEntry,          // from uploaderId query
        docEntry,          // from legacyAppUserId query (same path — should be de-duped)
        { path: "orgs/o1/documents/d2", data: { uploadedBy: USER_ID } }, // distinct doc
      ],
    };

    const bundle = assembleUserBundle(USER_ID, results, NOW_MS);

    // d1 appears once (de-duped), d2 appears once — total 2 docs
    expect(bundle.documents).toHaveLength(2);
    const paths = bundle.documents.map((d) => d.path);
    expect(paths).toContain("orgs/o1/documents/d1");
    expect(paths).toContain("orgs/o1/documents/d2");
    // No duplicates
    expect(new Set(paths).size).toBe(2);
  });

  // Test 5: JSON roundtrip — no Date/Timestamp objects survive serialization
  it("produces a bundle that survives JSON.parse(JSON.stringify()) with deep-equal result", () => {
    const results: QueryResults = {
      profile: { displayName: "Bob", createdAt: "2024-01-01T00:00:00.000Z" },
      auditEvents: [
        { eventId: "e1", actor: { uid: USER_ID }, at: "2024-01-01T00:00:00.000Z" },
      ],
      responses: [{ path: "orgs/o1/responses/r1", data: { score: 5 } }],
      comments: [],
      messages: [{ path: "orgs/o1/messages/m1", data: { body: "test" } }],
      actions: [],
      documents: [{ path: "documents/d1", data: { filename: "report.pdf" } }],
      funnelComments: [],
    };

    const bundle = assembleUserBundle(USER_ID, results, NOW_MS);
    const roundtripped = JSON.parse(JSON.stringify(bundle)) as typeof bundle;

    // Deep equality — no loss of precision
    expect(roundtripped).toEqual(bundle);
    // assembledAt is an ISO string (not a Date object)
    expect(typeof roundtripped.assembledAt).toBe("string");
    expect(roundtripped.assembledAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // bundleSchemaVersion is a number
    expect(typeof roundtripped.bundleSchemaVersion).toBe("number");
  });

  // Supplementary: DOCUMENT_AUTHOR_FIELDS export is correct
  it("exports DOCUMENT_AUTHOR_FIELDS with all three confirmed field names", () => {
    expect(DOCUMENT_AUTHOR_FIELDS).toContain("uploaderId");
    expect(DOCUMENT_AUTHOR_FIELDS).toContain("uploadedBy");
    expect(DOCUMENT_AUTHOR_FIELDS).toContain("legacyAppUserId");
    expect(DOCUMENT_AUTHOR_FIELDS).toHaveLength(3);
  });
});
