import type { Goal, Match, Team } from "./types";

/**
 * Scoring rules (spec §10):
 *  - win: 2 pts
 *  - win with a clean sheet (conceded 0): 3 pts
 *  - "big win" (won by 3+ goals): 3 pts
 *  - draw: 1 pt each
 *  - loss: 0 pts
 * If a win is both a clean sheet AND a big win, it still only scores 3
 * (the bonuses don't stack — spec has no rule for a double bonus).
 */
const BIG_WIN_MARGIN = 3;

export interface ScorableGoal {
  scorer_id: string;
  is_own_goal: boolean;
}

export function goalsToScore(goals: ScorableGoal[], teamAPlayerIds: Set<string>) {
  // Own goals count for the OPPOSING team's score, per spec §9
  // ("assist must belong to scorer's team" implies goals belong to scorer's team
  // unless flagged as an own goal, in which case it's credited to the other side).
  let scoreA = 0;
  let scoreB = 0;
  for (const g of goals) {
    const scorerOnA = teamAPlayerIds.has(g.scorer_id);
    if (g.is_own_goal) {
      if (scorerOnA) scoreB += 1;
      else scoreA += 1;
    } else {
      if (scorerOnA) scoreA += 1;
      else scoreB += 1;
    }
  }
  return { scoreA, scoreB };
}

export interface MatchResult {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

export interface TeamPointsDelta {
  teamId: string;
  points: number;
  won: boolean;
  drew: boolean;
  lost: boolean;
  cleanSheet: boolean;
  bigWin: boolean;
}

export function computeMatchPoints(result: MatchResult): [TeamPointsDelta, TeamPointsDelta] {
  const { homeTeamId, awayTeamId, homeScore, awayScore } = result;
  const margin = Math.abs(homeScore - awayScore);

  if (homeScore === awayScore) {
    return [
      { teamId: homeTeamId, points: 1, won: false, drew: true, lost: false, cleanSheet: false, bigWin: false },
      { teamId: awayTeamId, points: 1, won: false, drew: true, lost: false, cleanSheet: false, bigWin: false },
    ];
  }

  const homeWon = homeScore > awayScore;
  const winnerId = homeWon ? homeTeamId : awayTeamId;
  const loserId = homeWon ? awayTeamId : homeTeamId;
  const loserScore = homeWon ? awayScore : homeScore;

  const cleanSheet = loserScore === 0;
  const bigWin = margin >= BIG_WIN_MARGIN;
  const winPoints = cleanSheet || bigWin ? 3 : 2;

  return [
    { teamId: winnerId, points: winPoints, won: true, drew: false, lost: false, cleanSheet, bigWin },
    { teamId: loserId, points: 0, won: false, drew: false, lost: true, cleanSheet: false, bigWin: false },
  ];
}

/** Team standings row: same fields as `Team`, plus the extra columns the
 * results table needs (wins/draws/losses, goals for/against). */
export type TeamStanding = Team & {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

/** Aggregates all finished matches of a tournament into team standings + places.
 * Tiebreak order: points -> head-to-head record among the tied teams (points,
 * then goal diff, counting only matches between them) -> overall goal diff. */
export function computeStandings(
  teams: Team[],
  matches: Match[],
  goalsByMatch: Record<string, Goal[]>,
  playersByTeam: Record<string, Set<string>>
): TeamStanding[] {
  const points: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
  const goalDiff: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
  const goalsFor: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
  const goalsAgainst: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
  const wins: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
  const draws: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
  const losses: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
  const h2hPoints: Record<string, Record<string, number>> = Object.fromEntries(
    teams.map((t) => [t.id, Object.fromEntries(teams.map((o) => [o.id, 0]))])
  );
  const h2hGoalDiff: Record<string, Record<string, number>> = Object.fromEntries(
    teams.map((t) => [t.id, Object.fromEntries(teams.map((o) => [o.id, 0]))])
  );

  for (const m of matches) {
    if (m.status !== "finished") continue;
    const goals = goalsByMatch[m.id] ?? [];
    const homePlayers = playersByTeam[m.team_home_id] ?? new Set();
    const { scoreA: homeScore, scoreB: awayScore } = goalsToScore(goals, homePlayers);

    const [homeDelta, awayDelta] = computeMatchPoints({
      matchId: m.id,
      homeTeamId: m.team_home_id,
      awayTeamId: m.team_away_id,
      homeScore,
      awayScore,
    });

    points[homeDelta.teamId] += homeDelta.points;
    points[awayDelta.teamId] += awayDelta.points;
    goalDiff[m.team_home_id] += homeScore - awayScore;
    goalDiff[m.team_away_id] += awayScore - homeScore;
    goalsFor[m.team_home_id] += homeScore;
    goalsAgainst[m.team_home_id] += awayScore;
    goalsFor[m.team_away_id] += awayScore;
    goalsAgainst[m.team_away_id] += homeScore;

    if (homeDelta.won) wins[homeDelta.teamId] += 1;
    else if (homeDelta.drew) draws[homeDelta.teamId] += 1;
    else losses[homeDelta.teamId] += 1;

    if (awayDelta.won) wins[awayDelta.teamId] += 1;
    else if (awayDelta.drew) draws[awayDelta.teamId] += 1;
    else losses[awayDelta.teamId] += 1;

    h2hPoints[m.team_home_id][m.team_away_id] += homeDelta.points;
    h2hPoints[m.team_away_id][m.team_home_id] += awayDelta.points;
    h2hGoalDiff[m.team_home_id][m.team_away_id] += homeScore - awayScore;
    h2hGoalDiff[m.team_away_id][m.team_home_id] += awayScore - homeScore;
  }

  // Group teams by points, then break ties within each group using a
  // mini-league of head-to-head results among just that group's teams.
  const byPoints = new Map<number, Team[]>();
  for (const t of teams) {
    const arr = byPoints.get(points[t.id]) ?? [];
    arr.push(t);
    byPoints.set(points[t.id], arr);
  }
  const orderedGroups = [...byPoints.entries()].sort((a, b) => b[0] - a[0]);

  const ranked: Team[] = [];
  for (const [, group] of orderedGroups) {
    if (group.length === 1) {
      ranked.push(group[0]);
      continue;
    }
    const groupIds = group.map((t) => t.id);
    const sumAgainstGroup = (table: Record<string, Record<string, number>>, teamId: string) =>
      groupIds.reduce((sum, otherId) => (otherId === teamId ? sum : sum + table[teamId][otherId]), 0);

    const sortedGroup = [...group].sort((a, b) => {
      const h2hPts = sumAgainstGroup(h2hPoints, a.id) - sumAgainstGroup(h2hPoints, b.id);
      if (h2hPts !== 0) return h2hPts;

      const h2hGd = sumAgainstGroup(h2hGoalDiff, a.id) - sumAgainstGroup(h2hGoalDiff, b.id);
      if (h2hGd !== 0) return h2hGd;

      return goalDiff[b.id] - goalDiff[a.id];
    });
    ranked.push(...sortedGroup);
  }

  return ranked.map((t, i) => ({
    ...t,
    points: points[t.id],
    place: i + 1,
    wins: wins[t.id],
    draws: draws[t.id],
    losses: losses[t.id],
    goalsFor: goalsFor[t.id],
    goalsAgainst: goalsAgainst[t.id],
  }));
}

/** Generates a round-robin schedule for 3 teams played 4x each pairing = 12 matches (spec §9).
 * Pairing order is always A-B, A-C, B-C, repeated identically every cycle
 * (match #1 А-Б, #2 А-В, #3 Б-В, #4 А-Б, ...). No home/away alternation —
 * that used to flip every other cycle, but since scoring only cares about
 * the final score (not which side is "home"), the flip added complexity
 * without changing outcomes and was a source of bugs. `round` is used
 * directly as the sequential match number shown in the UI. */
export function generateRoundRobinSchedule(eventId: string, teamIds: [string, string, string]) {
  const [a, b, c] = teamIds;
  const pairings: [string, string][] = [
    [a, b],
    [a, c],
    [b, c],
  ];
  const cycles = 4; // 3 pairings x 4 cycles = 12 matches total
  const schedule: { event_id: string; team_home_id: string; team_away_id: string; round: number; status: "pending" }[] = [];

  let seq = 0;
  for (let cycle = 1; cycle <= cycles; cycle++) {
    for (const [home, away] of pairings) {
      seq += 1;
      schedule.push({
        event_id: eventId,
        team_home_id: home,
        team_away_id: away,
        round: seq,
        status: "pending",
      });
    }
  }
  return schedule;
}