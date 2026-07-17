import type { EventPlayer, Goal, Match } from "./types";
import { computeMatchPoints, goalsToScore } from "./scoring";

export interface PlayerStatLine {
  user_id: string;
  team_id: string;
  goals: number;
  assists: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets: number;
}

/**
 * Rebuilds every selected player's stat line for one tournament from scratch,
 * given all finished matches + their goals. Cheap enough to just recompute
 * in full after every match result rather than track deltas (spec §16: no
 * SQL triggers, keep the logic simple TS).
 */
export function computePlayerStatsForEvent(
  selectedPlayers: EventPlayer[], // status === 'selected', each has team_id
  matches: Match[],
  goalsByMatch: Record<string, Goal[]>
): PlayerStatLine[] {
  const lines = new Map<string, PlayerStatLine>();
  const playersByTeam = new Map<string, string[]>(); // team_id -> user_ids

  for (const p of selectedPlayers) {
    if (!p.team_id) continue;
    lines.set(p.user_id, {
      user_id: p.user_id,
      team_id: p.team_id,
      goals: 0,
      assists: 0,
      matches_played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      clean_sheets: 0,
    });
    const arr = playersByTeam.get(p.team_id) ?? [];
    arr.push(p.user_id);
    playersByTeam.set(p.team_id, arr);
  }

  for (const m of matches) {
    if (m.status !== "finished") continue;
    const goals = goalsByMatch[m.id] ?? [];
    const homeIds = new Set(playersByTeam.get(m.team_home_id) ?? []);
    const awayIds = new Set(playersByTeam.get(m.team_away_id) ?? []);
    const { scoreA: homeScore, scoreB: awayScore } = goalsToScore(goals, homeIds);

    const [homeDelta, awayDelta] = computeMatchPoints({
      matchId: m.id,
      homeTeamId: m.team_home_id,
      awayTeamId: m.team_away_id,
      homeScore,
      awayScore,
    });

    applyMatchOutcome(lines, homeIds, homeDelta, awayScore === 0);
    applyMatchOutcome(lines, awayIds, awayDelta, homeScore === 0);

    for (const g of goals) {
      if (g.is_own_goal) continue; // own goals don't count as personal goals
      const scorerLine = lines.get(g.scorer_id);
      if (scorerLine) scorerLine.goals += 1;
      if (g.assister_id) {
        const assistLine = lines.get(g.assister_id);
        if (assistLine) assistLine.assists += 1;
      }
    }
  }

  return [...lines.values()];
}

function applyMatchOutcome(
  lines: Map<string, PlayerStatLine>,
  playerIds: Set<string>,
  delta: { won: boolean; drew: boolean; lost: boolean },
  concededZero: boolean
) {
  for (const id of playerIds) {
    const line = lines.get(id);
    if (!line) continue;
    line.matches_played += 1;
    if (delta.won) line.wins += 1;
    if (delta.drew) line.draws += 1;
    if (delta.lost) line.losses += 1;
    if (concededZero) line.clean_sheets += 1;
  }
}
