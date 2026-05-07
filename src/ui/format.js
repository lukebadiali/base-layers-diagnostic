// src/ui/format.js
// @ts-check
// Phase 4 Wave 2 (D-12): re-exports the format helpers Phase 2 already extracted
// to src/util/ids.js. Provides the ui/format import path views/* expect per
// ARCHITECTURE.md §2 helpers table — keeping the util/ids.js implementation
// in place so the existing 100% src/util/** coverage threshold continues to
// fence the implementation.
export { formatWhen, iso, initials, firstNameFromAuthor } from "../util/ids.js";
