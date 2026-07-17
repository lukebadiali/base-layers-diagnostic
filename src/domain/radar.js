// src/domain/radar.js
// @ts-check
// Builds one radar dataset per round that has data for the viewed account.
// Pure + firebase-free (domain boundary). Colours are assigned by the view
// layer (drawRadar), not here.

/**
 * @param {Array<{ id:string, label?:string, createdAt?:string }>} rounds
 * @param {Array<{ id:number }>} pillars
 * @param {(roundId:string, pillarId:number) => number|null} scoreForRound
 * @returns {Array<{ roundId:string, label:string, createdAt:string|undefined, data:number[] }>}
 */
export function roundRadarDatasets(rounds, pillars, scoreForRound) {
  return (rounds || [])
    .map((round) => {
      const raw = pillars.map((p) => scoreForRound(round.id, p.id));
      const hasData = raw.some((v) => v !== null && v !== undefined);
      return {
        roundId: round.id,
        label: round.label || round.id,
        createdAt: round.createdAt,
        data: raw.map((v) => (v == null ? 0 : v)),
        hasData,
      };
    })
    .filter((d) => d.hasData)
    .map(({ hasData: _hasData, ...keep }) => keep);
}
