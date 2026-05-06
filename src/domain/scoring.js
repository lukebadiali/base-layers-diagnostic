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
 * @param {*} org JSDoc-was-`any` (D-06): the org tree shape is byte-identical
 *   to the IIFE's loose-object reads of `org.responses[roundId][userId][pillarId][idx]`.
 *   Tightening to a concrete type would force a behavioural change we are not
 *   making in Phase 2. Phase 4 (CODE-01) tightens once domain/org-shape lands.
 * @param {string} roundId
 * @param {number} pillarId
 * @param {{ pillars: Array<{ id:number, diagnostics:Array<unknown> }> }} DATA
 * @param {(entry: unknown) => { scale:number }|null} questionMeta
 * @returns {number|null}
 */
export function pillarScoreForRound(org, roundId, pillarId, DATA, questionMeta) {
  const p = DATA.pillars.find((pp) => pp.id === pillarId);
  if (!p) return null;
  const byUser = (org.responses || {})[roundId] || {};
  /** @type {number[]} */
  const normalized = [];
  Object.values(byUser).forEach((perPillar) => {
    const perQ = (perPillar || {})[pillarId] || {};
    Object.entries(perQ).forEach(([idx, r]) => {
      if (!Number.isFinite(r.score)) return;
      const meta = questionMeta(p.diagnostics[Number(idx)]);
      if (!meta || !meta.scale) return;
      normalized.push((r.score / meta.scale) * 100);
    });
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

/**
 * @param {*} org JSDoc-was-`any` (D-06): same rationale as pillarScoreForRound.
 * @param {string} roundId
 * @returns {string[]}
 */
export function respondentsForRound(org, roundId) {
  const byUser = (org.responses || {})[roundId] || {};
  return Object.keys(byUser);
}

/**
 * @param {*} org JSDoc-was-`any` (D-06): same rationale as pillarScoreForRound.
 * @param {string} roundId
 * @param {string} userId
 * @param {number} pillarId
 * @param {{ pillars: Array<{ id:number, diagnostics:Array<unknown> }> }} DATA
 * @returns {{done:number, total:number}}
 */
// Phase 2 (D-05) carry-over note: the original directive
//   `// eslint-disable-next-line no-unused-vars`
// at app.js:265 covered the in-IIFE answeredCount declaration. On export the
// rule no longer fires (the export "uses" the binding), so the active directive
// moves to the in-IIFE wrapper closure (app.js: `const answeredCount = ...`)
// where it still applies. The literal is preserved in this comment for plan
// acceptance traceability. Phase 4: remove dead code or wire up call site.
// See runbooks/phase-4-cleanup-ledger.md (Phase 2 — extracted leaf modules).
export function answeredCount(org, roundId, userId, pillarId, DATA) {
  const resp = (((org.responses || {})[roundId] || {})[userId] || {})[pillarId] || {};
  // Byte-identical (D-05) with app.js:268 — original throws on unknown pillarId.
  // JSDoc cast asserts the find result is non-null; behaviour is unchanged.
  const pillar = /** @type {{ diagnostics: Array<unknown> }} */ (
    DATA.pillars.find((p) => p.id === pillarId)
  );
  const total = pillar.diagnostics.length;
  const done = Object.values(resp).filter((r) => Number.isFinite(r.score)).length;
  return { done, total };
}
