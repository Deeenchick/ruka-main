/**
 * Player card stats (FIFA/EA FC-style attribute card) — src/components/rating/PlayerCard.tsx
 *
 * All 6 attributes are raw ratios non-linearly squashed onto a 0-100 scale via
 * a logistic curve, so:
 *  - most players land in the 50-90 range
 *  - 100 is nearly unreachable
 *  - the curve is NOT linear (per spec)
 *
 * The (mid, k) constants below are reasonable defaults, not from a spec —
 * tune them once real season data shows what "average" actually looks like.
 * `mid` = raw ratio that should land at exactly 50. `k` = how sharply the
 * curve rises around that midpoint (higher k = steeper).
 */

export interface PlayerCardStats {
  impact: number; // ⚡ ИМП — (голы+пасы) / матчи
  winRate: number; // 🏆 ПОБ — победы / матчи
  topRate: number; // 🥈 ТОП — турниры в топ-2 / все посещённые турниры
  reliability: number; // 🛡 НАД — сухие матчи / матчи
  stability: number; // 📈 СТБ — по разбросу PEI (меньше разброс = выше)
  discipline: number; // 📅 ДИС — посещённые турниры / все турниры сезона
}

/** Same 6 attributes, but as their real underlying numbers (no percentile scaling) — shown on tap. */
export interface PlayerCardRaw {
  impact: string;
  winRate: string;
  topRate: string;
  reliability: string;
  stability: string;
  discipline: string;
}

export interface PlayerCardInput {
  totalGoals: number;
  totalAssists: number;
  totalMatches: number;
  totalWins: number;
  totalCleanSheets: number;
  peiHistory: number[]; // all PEI values, any order
  tournamentsAttended: number;
  tournamentsInTop2: number;
  tournamentsThisSeason: number;
}

function logistic10(value: number, mid: number, k: number, invert = false): number {
  const z = invert ? mid - value : value - mid;
  const score = 100 / (1 + Math.exp(-k * z));
  return Math.round(score);
}

function stdev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

export function computePlayerCardStats(input: PlayerCardInput): PlayerCardStats {
  const {
    totalGoals,
    totalAssists,
    totalMatches,
    totalWins,
    totalCleanSheets,
    peiHistory,
    tournamentsAttended,
    tournamentsInTop2,
    tournamentsThisSeason,
  } = input;

  const m = Math.max(totalMatches, 1); // guard div/0 — with 0 matches every ratio is 0 anyway

  const impact = logistic10((totalGoals + totalAssists) / m, 0.4, 3);
  // Teams are balance-drafted, so ~50% win rate is the honest baseline, not
  // an achievement in itself — that's why it sits right at the midpoint.
  const winRate = logistic10(totalWins / m, 0.45, 5);
  // Baseline luck matters here: with 3 teams, landing top-2 by pure chance is
  // ~0.67 — midpoint is set a bit below that so consistent top-2 finishes still
  // read as skill, without punishing the lucky/unlucky swings too hard.
  const topRate = logistic10(tournamentsAttended > 0 ? tournamentsInTop2 / tournamentsAttended : 0, 0.6, 5);
  const reliability = logistic10(totalCleanSheets / m, 0.15, 8);
  // Needs at least 2 tournaments to mean anything; otherwise there's no spread to judge.
  const stability = peiHistory.length >= 2 ? logistic10(stdev(peiHistory), 1.2, 2.2, true) : 5.0;
  const discipline = logistic10(tournamentsThisSeason > 0 ? tournamentsAttended / tournamentsThisSeason : 0, 0.55, 5);

  return { impact, winRate, topRate, reliability, stability, discipline };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function computePlayerCardRaw(input: PlayerCardInput): PlayerCardRaw {
  const {
    totalGoals,
    totalAssists,
    totalMatches,
    totalWins,
    totalCleanSheets,
    peiHistory,
    tournamentsAttended,
    tournamentsInTop2,
    tournamentsThisSeason,
  } = input;

  const m = Math.max(totalMatches, 1);

  return {
    impact: `${((totalGoals + totalAssists) / m).toFixed(2)}/матч`,
    winRate: pct(totalWins / m),
    topRate: pct(tournamentsAttended > 0 ? tournamentsInTop2 / tournamentsAttended : 0),
    reliability: pct(totalCleanSheets / m),
    stability: peiHistory.length >= 2 ? `${stdev(peiHistory).toFixed(2)}` : "н/д",
    discipline: pct(tournamentsThisSeason > 0 ? tournamentsAttended / tournamentsThisSeason : 0),
  };
}

export type RatingTier = "steel" | "bronze" | "silver" | "gold";

export function ratingTier(ovr: number): RatingTier {
  if (ovr >= 4.5) return "gold";
  if (ovr >= 3) return "silver";
  if (ovr >= 2) return "bronze";
  return "steel";
}