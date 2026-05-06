// src/domain/completion.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:282-307.
// pillarStatus imported from banding.js (Wave 2); pillarScore + DATA injected
// because pillarScore lives in scoring.js with its own DI surface, and DATA
// is window.BASE_LAYERS — the IIFE binds both.
import { pillarStatus } from "./banding.js";

/**
 * @param {*} org
 * @param {string} roundId
 * @param {string} userId
 * @param {{ pillars: Array<{ id:number, diagnostics:Array<unknown> }> }} DATA
 */
export function userCompletionPct(org, roundId, userId, DATA) {
  const totalQ = DATA.pillars.reduce((s, p) => s + p.diagnostics.length, 0);
  const resp = ((org.responses || {})[roundId] || {})[userId] || {};
  let done = 0;
  DATA.pillars.forEach((p) => {
    const pq = resp[p.id] || {};
    done += Object.values(pq).filter((r) => Number.isFinite(r.score)).length;
  });
  return Math.round((done / totalQ) * 100);
}

/**
 * @param {*} org
 * @param {{ pillars: Array<{ id:number }> }} DATA
 * @param {(org: *, pillarId: number) => number|null} pillarScore
 */
export function orgSummary(org, DATA, pillarScore) {
  const scored = DATA.pillars.map((p) => pillarScore(org, p.id)).filter((s) => s !== null);
  const avg = scored.length
    ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
    : null;
  const statuses = DATA.pillars.map((p) => pillarStatus(pillarScore(org, p.id)));
  return {
    avg,
    red: statuses.filter((s) => s === "red").length,
    amber: statuses.filter((s) => s === "amber").length,
    green: statuses.filter((s) => s === "green").length,
    gray: statuses.filter((s) => s === "gray").length,
    scoredCount: scored.length,
  };
}
