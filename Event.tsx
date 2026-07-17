/**
 * PEI — Player Efficiency Index for a single tournament, capped at 10.
 *
 * PEI = MIN(10;
 *   ((голы × 1.1 + пасы × 1.0) ÷ 8 × 3.0)
 *   + бонус_за_место
 *   + (матчи_без_поражений × 0.12)
 *   + MAX(0; (голы − 4) × 0.08)
 *   + MAX(0; (пасы − 3) × 0.12)
 * )
 *
 * Unlike the previous version, this is all raw tournament totals — nothing
 * is normalized per match played.
 *
 * "бонус_за_место":
 *  - team finished 1st: +2
 *  - team finished 2nd: +1
 *  - team finished 3rd: +0.3
 *  - no team: +0
 */
export interface PeiInput {
  goals: number;
  assists: number;
  matchesWithoutLosses: number; // wins + draws
  teamPlace: number | null; // 1, 2, or 3
}

const MAX_PEI = 10;

export function computePei(input: PeiInput): number {
  const { goals, assists, matchesWithoutLosses, teamPlace } = input;

  const base = ((goals * 1.1 + assists * 1.0) / 8) * 3.0;
  const placeBonus = teamPlace === 1 ? 2 : teamPlace === 2 ? 1 : teamPlace === 3 ? 0.3 : 0;
  const noLossBonus = matchesWithoutLosses * 0.12;
  const goalStreakBonus = Math.max(0, (goals - 4) * 0.08);
  const assistStreakBonus = Math.max(0, (assists - 3) * 0.12);

  const total = base + placeBonus + noLossBonus + goalStreakBonus + assistStreakBonus;
  return Math.round(Math.min(MAX_PEI, total) * 100) / 100;
}