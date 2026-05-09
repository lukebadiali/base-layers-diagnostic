// Phase 7 Wave 1 (FN-03): Zod -> HttpsError("invalid-argument") wrapper.
// Pure-logic helper per Pattern C purity contract — MUST NOT import from
// firebase-admin/*. Imports firebase-functions/v2/https only for the
// HttpsError type and constructor.

import { HttpsError } from "firebase-functions/v2/https";
import { z, ZodError, type ZodTypeAny } from "zod";

/**
 * Validate `input` against `schema`; on success return the typed result.
 * On ZodError translate to HttpsError("invalid-argument") with a message
 * enumerating each path/message pair. Non-Zod throws are wrapped as
 * "invalid-argument: Validation failed" so callers always get HttpsError.
 */
export function validateInput<S extends ZodTypeAny>(
  schema: S,
  input: unknown,
): z.infer<S> {
  try {
    return schema.parse(input) as z.infer<S>;
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = (err.issues ?? []).map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      const summary = issues.length > 0 ? issues.join(", ") : err.message;
      throw new HttpsError(
        "invalid-argument",
        `Validation failed: ${summary}`,
      );
    }
    throw new HttpsError("invalid-argument", "Validation failed");
  }
}
