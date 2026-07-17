/**
 * Global rating:
 *  - brand-new player starts at 2.5
 *  - 3 or fewer tournaments played: median of all PEI scores
 *  - more than 3 tournaments: 0.7 * median(all PEI) + 0.3 * median(last 3 PEI)
 *
 * `peiHistory` must be ordered oldest -> newest.
 */
export const NEW_PLAYER_RATING = 2.5;

export function computeGlobalRating(peiHistory: number[]): number {
  if (peiHistory.length === 0) return NEW_PLAYER_RATING;

  const medAll = median(peiHistory);

  if (peiHistory.length <= 3) {
    return round2(medAll);
  }

  const last3 = peiHistory.slice(-3);
  const medLast3 = median(last3);
  return round2(0.7 * medAll + 0.3 * medLast3);
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}