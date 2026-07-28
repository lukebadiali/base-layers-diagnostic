// src/domain/scoring.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:219-235 (pillarScoreForRound),
// 237-239 (pillarScore), 248-251 (respondentsForRound), 253-259 (answeredCount).
// Planner-cited as app.js:240-280 (pre-Plan-02-01 line shift). questionMeta + DATA
// injected as parameters per Pattern D (RESEARCH.md "Pattern 2: Dependency injection
// for non-pure leaves") because they live in the IIFE; Phase 4 will move DATA into
// a domain/pillars.js module and import questionMeta directly. The eslint-disable
// for answeredCount carries over from app.js:253 — answeredCount is dead code
// pending Phase 4 cleanup (see runbooks/phase-4-cleanup-ledger.md).

/**
 * A response counts toward scoring / "answered" ONLY when its score is a finite
 * number within the question's current 1..scale range — the SAME rule the
 * diagnostic UI uses to light a figure (renderQuestion in src/main.js). Stale
 * answers left over from an earlier question-set/scale (e.g. a score of 8
 * captured when a question was 1..10, now that it is 1..5) fall outside the
 * range and MUST NOT affect the average (2026-07 fix). Before this, the UI
 * hid such scores as unselected while the average still counted them —
 * normalized against the wrong scale — so the pillar number reflected figures
 * that weren't shown selected. Centralised here so display, score, and the
 * answered-count can never diverge again.
 * @param {*} score
 * @param {number} scale
 * @returns {boolean}
 */
export function isScoredInScale(score, scale) {
  return Number.isFinite(score) && score >= 1 && score <= scale;
}

/**
 * @param {*} org JSDoc-was-`any` (D-06): the org tree shape is byte-identical
 *   to the IIFE's loose-object reads of `org.responses[roundId][pillarId][idx]`
 *   (2026-07 org-level re-shift: one shared answer sheet per org per round —
 *   the per-account dimension was removed).
 * @param {string} roundId
 * @param {number} pillarId
 * @param {{ pillars: Array<{ id:number, diagnostics:Array<unknown> }> }} DATA
 * @param {(entry: unknown) => { scale:number }|null} questionMeta
 * @returns {number|null}
 */
export function pillarScoreForRound(org, roundId, pillarId, DATA, questionMeta) {
  const p = DATA.pillars.find((pp) => pp.id === pillarId);
  if (!p) return null;
  const perQ = ((org.responses || {})[roundId] || {})[pillarId] || {};
  /** @type {number[]} */
  const normalized = [];
  Object.entries(perQ).forEach(([idx, r]) => {
    const meta = questionMeta(p.diagnostics[Number(idx)]);
    if (!meta || !meta.scale) return;
    // Only in-scale scores count — excludes stale out-of-range answers that
    // the UI already hides (parity with renderQuestion's display clamp).
    if (!isScoredInScale(r.score, meta.scale)) return;
    normalized.push((r.score / meta.scale) * 100);
  });
  if (!normalized.length) return null;
  return Math.round(normalized.reduce((a, b) => a + b, 0) / normalized.length);
}

/**
 * @param {*} org JSDoc-was-`any` (D-06): same rationale as pillarScoreForRound.
 * @param {number} pillarId
 * @param {{ pillars: Array<{ id:number, diagnostics:Array<unknown> }> }} DATA
 * @param {(entry: unknown) => { scale:number }|null} questionMeta
 * @returns {number|null}
 */
export function pillarScore(org, pillarId, DATA, questionMeta) {
  return pillarScoreForRound(org, org.currentRoundId, pillarId, DATA, questionMeta);
}
