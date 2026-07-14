// src/domain/diagnostic-select.js
// @ts-check
// Pure toggle semantics for the diagnostic Likert figures. Kept as a domain
// leaf (imports nothing) so it is unit-testable without booting main.js.
//
// UX polish (2026-07): clicking a figure selects it; re-clicking the figure
// that is already selected CLEARS it (deselect). A cleared score is `null`,
// which fails Number.isFinite() — the predicate the whole app uses to decide
// whether a question is answered (src/domain/scoring.js, main.js
// answerSummaryForPillar) — so a deselected figure reverts to "not answered".

/**
 * @param {number|null} selectedScore the currently-selected score, or null when
 *   the question is unanswered.
 * @param {number} clickedScore the figure the user just clicked (1..scale).
 * @returns {{ score: number|null }} patch to hand to setResponse(): the same
 *   score to select it, or `{ score: null }` to clear it when re-clicked.
 */
export function toggleScorePatch(selectedScore, clickedScore) {
  return { score: selectedScore === clickedScore ? null : clickedScore };
}
