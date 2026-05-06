// src/domain/banding.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:241-246 (pillarStatus,
// planner-cited as app.js:262-267) + app.js:2781-2806 (bandLabel, bandStatement,
// bandColor, planner-cited as app.js:2816-2841). pillarStatus lives in the
// scoring section of app.js but conceptually belongs to banding (D-02).
// Boundaries (50, 75) intentionally duplicated across the four functions —
// Phase 4 may pull constants into a named export.

/** @param {number|null|undefined} score */
export function pillarStatus(score) {
  if (score === null || score === undefined) return "gray";
  if (score <= 50) return "red";
  if (score <= 75) return "amber";
  return "green";
}

/** @param {number|null|undefined} s */
export function bandLabel(s) {
  if (s === null || s === undefined) return "Not scored";
  if (s <= 50) return "Low";
  if (s <= 75) return "Medium";
  return "High";
}

/**
 * @param {string} pillarName
 * @param {number|null|undefined} s
 */
export function bandStatement(pillarName, s) {
  if (s === null || s === undefined) {
    return `${pillarName} has not yet been scored. Once the diagnostic is complete, you will see a detailed view here including your development priorities.`;
  }
  if (s <= 50) {
    return `Your team scored ${s}/100 on ${pillarName}. This is a LOW score and a priority development area. Investment here is likely to unlock compounding gains across other pillars, because ${pillarName.toLowerCase()} sits upstream of how the rest of your commercial engine performs.`;
  }
  if (s <= 75) {
    return `Your team scored ${s}/100 on ${pillarName}. This is a MEDIUM score. Foundational elements are in place, but there is clear room to strengthen consistency, codify what is working, and remove variability between individuals and situations.`;
  }
  return `Your team scored ${s}/100 on ${pillarName}. This is a HIGH score and, on current evidence, a strength. The opportunity here is to maintain discipline, protect the standard as you scale, and treat this as a competitive advantage worth defending.`;
}

/** @param {number|null|undefined} s */
export function bandColor(s) {
  if (s === null || s === undefined) return "var(--line-2)";
  if (s <= 50) return "var(--red)";
  if (s <= 75) return "var(--amber)";
  return "var(--green)";
}
