// tests/rules/setup.js
// @ts-check
// Phase 5 Wave 1 (D-14 / D-16): shared RulesTestEnvironment factory + ROLES
// table + asUser helper. Every tests/rules/*.test.js file imports from here.
// Uses @firebase/rules-unit-testing v5 API (initializeTestEnvironment) per
// RESEARCH.md Pattern 4 + Pitfall 6.
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Initialise the rules test environment for a given service ("firestore" or
 * "storage"). Each test file MUST pass a unique `projectIdSuffix` so that
 * multiple test files running in the same vitest fork don't share emulator
 * state (RulesTestEnvironment.clearFirestore wipes ALL data for projectId).
 * Pattern 4 closure: per-file projectId namespace.
 * @param {"firestore"|"storage"} service
 * @param {string} [projectIdSuffix]
 */
export async function initRulesEnv(service, projectIdSuffix = "default") {
  const projectId = `demo-rules-${projectIdSuffix}`;
  const config =
    service === "firestore"
      ? {
          projectId,
          firestore: {
            rules: readFileSync(
              resolve(process.cwd(), "firestore.rules"),
              "utf8",
            ),
            host: "127.0.0.1",
            port: 8080,
          },
        }
      : {
          projectId,
          storage: {
            rules: readFileSync(
              resolve(process.cwd(), "storage.rules"),
              "utf8",
            ),
            host: "127.0.0.1",
            port: 9199,
          },
        };
  return initializeTestEnvironment(config);
}

/** ROLES per D-16 - 5 roles cover the full matrix. */
export const ROLES = [
  { role: "anonymous", claims: {} },
  {
    role: "client_orgA",
    claims: { role: "client", orgId: "orgA", email_verified: true },
  },
  {
    role: "client_orgB",
    claims: { role: "client", orgId: "orgB", email_verified: true },
  },
  {
    role: "internal",
    claims: { role: "internal", orgId: null, email_verified: true },
  },
  {
    role: "admin",
    claims: { role: "admin", orgId: null, email_verified: true },
  },
];

/**
 * @param {*} testEnv
 * @param {string} roleName
 * @param {object} claims
 */
export function asUser(testEnv, roleName, claims) {
  if (roleName === "anonymous")
    return testEnv.unauthenticatedContext().firestore();
  return testEnv
    .authenticatedContext(roleName, {
      ...claims,
      firebase: { sign_in_provider: "password" },
    })
    .firestore();
}

/**
 * @param {*} testEnv
 * @param {string} roleName
 * @param {object} claims
 */
export function asStorageUser(testEnv, roleName, claims) {
  if (roleName === "anonymous")
    return testEnv.unauthenticatedContext().storage();
  return testEnv
    .authenticatedContext(roleName, {
      ...claims,
      firebase: { sign_in_provider: "password" },
    })
    .storage();
}

export { assertSucceeds, assertFails };
