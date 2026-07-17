import { supabase } from "./supabase";
import { selectPlayerPool, snakeDraft, dealSnake, shuffleCloseRatings, averageTeamRating, type DraftedTeam } from "./draft";
import { generateRoundRobinSchedule, computeStandings } from "./scoring";
import { computePlayerStatsForEvent } from "./playerStats";
import { computePei } from "./pei";
import { computeGlobalRating } from "./rating";
import type { Goal, RosterVoteAnswer, Team, VoteWithUser } from "./types";

/** Shared by formTeams/reformTeams: writes drafted teams + roster rows and
 * returns them with each team's average rating attached. */
async function createTeamsAndPlayers(eventId: string, drafted: DraftedTeam[], reserve: VoteWithUser[]) {
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .insert(drafted.map((t) => ({ event_id: eventId, name: t.name, points: 0 })))
    .select("*");
  if (teamsErr) throw teamsErr;

  const teamIdByName = Object.fromEntries((teams ?? []).map((t) => [t.name, t.id]));

  const selectedRows = drafted.flatMap((t) =>
    t.players.map((p) => ({
      event_id: eventId,
      user_id: p.id,
      team_id: teamIdByName[t.name],
      status: "selected" as const,
    }))
  );
  const reserveRows = reserve.map((v) => ({
    event_id: eventId,
    user_id: v.user_id,
    team_id: null,
    status: "reserve" as const,
  }));

  const { error: playersErr } = await supabase.from("event_players").insert([...selectedRows, ...reserveRows]);
  if (playersErr) throw playersErr;

  return drafted.map((t) => ({ ...t, averageRating: averageTeamRating(t.players) }));
}

/** spec §8: pool the first 15 "yes" (+ maybe fallback), snake-draft by rating into A/B/C. */
export async function formTeams(eventId: string, votes: VoteWithUser[]) {
  const { selected, reserve } = selectPlayerPool(votes);
  const drafted = snakeDraft(selected.map((v) => v.user));
  return createTeamsAndPlayers(eventId, drafted, reserve);
}

/** Wipes roster votes — called whenever the admin actually changes who's on which team,
 * so the "оставляем/меняем" poll always reflects opinions on the *current* split. */
async function clearRosterVotes(eventId: string) {
  const { error } = await supabase.from("roster_votes").delete().eq("event_id", eventId);
  if (error) throw error;
}

/**
 * "Поделить заново": wipes the current roster/teams for this event and re-drafts
 * from the same vote pool, shuffling players whose ratings are close enough to be
 * interchangeable first — so the split changes without breaking the balance.
 * Only safe to call before matches exist (UI should only expose this in "forming").
 */
export async function reformTeams(eventId: string, votes: VoteWithUser[]) {
  const { error: playersDelErr } = await supabase.from("event_players").delete().eq("event_id", eventId);
  if (playersDelErr) throw playersDelErr;
  const { error: teamsDelErr } = await supabase.from("teams").delete().eq("event_id", eventId);
  if (teamsDelErr) throw teamsDelErr;

  const { selected, reserve } = selectPlayerPool(votes);
  const shuffled = shuffleCloseRatings(selected.map((v) => v.user));
  const drafted = dealSnake(shuffled);
  const result = await createTeamsAndPlayers(eventId, drafted, reserve);
  await clearRosterVotes(eventId);
  return result;
}

/**
 * Manually replaces one selected player with another (admin override during "forming").
 * - If the incoming player was already selected on a different team, the two simply
 *   swap places.
 * - If the incoming player was in reserve/declined or has no event_players row at all,
 *   they take the outgoing player's slot and the outgoing player drops to reserve.
 */
export async function swapPlayer(eventId: string, outUserId: string, teamId: string, inUserId: string) {
  const { data: rows, error } = await supabase
    .from("event_players")
    .select("*")
    .eq("event_id", eventId)
    .in("user_id", [outUserId, inUserId]);
  if (error) throw error;

  const outRow = (rows ?? []).find((r) => r.user_id === outUserId);
  const inRow = (rows ?? []).find((r) => r.user_id === inUserId);
  if (!outRow) throw new Error("Игрок не найден в составе турнира");

  const isDirectSwap = !!inRow && inRow.status === "selected";
  const outNewTeamId = isDirectSwap ? inRow!.team_id : null;
  const outNewStatus = isDirectSwap ? "selected" : "reserve";

  const { error: outErr } = await supabase
    .from("event_players")
    .update({ team_id: outNewTeamId, status: outNewStatus })
    .eq("id", outRow.id);
  if (outErr) throw outErr;

  if (inRow) {
    const { error: inErr } = await supabase
      .from("event_players")
      .update({ team_id: teamId, status: "selected" })
      .eq("id", inRow.id);
    if (inErr) throw inErr;
  } else {
    const { error: insErr } = await supabase
      .from("event_players")
      .insert({ event_id: eventId, user_id: inUserId, team_id: teamId, status: "selected" });
    if (insErr) throw insErr;
  }

  await clearRosterVotes(eventId);
}

/**
 * Admin-only: fully cancels a tournament and wipes every trace of it —
 * votes, teams, rosters, matches, goals, stats, roster votes. All of it
 * cascades from the events row via `on delete cascade` FKs in schema.sql,
 * so a single delete here is enough.
 */
export async function cancelTournament(eventId: string) {
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

/** spec §-: selected players vote on whether to keep the current split or have it reshuffled. */
export async function voteRoster(eventId: string, userId: string, answer: RosterVoteAnswer) {
  const { error } = await supabase
    .from("roster_votes")
    .upsert(
      { event_id: eventId, user_id: userId, answer, updated_at: new Date().toISOString() },
      { onConflict: "event_id,user_id" }
    );
  if (error) throw error;
}

/** spec §9: 3 teams, round robin, 12 matches — generated once teams exist, then event goes active. */
export async function generateMatchesAndStart(eventId: string, teams: Team[]) {
  if (teams.length !== 3) throw new Error("Нужно ровно 3 команды, чтобы начать турнир");
  const [a, b, c] = teams;
  const schedule = generateRoundRobinSchedule(eventId, [a.id, b.id, c.id]);

  const { error: matchesErr } = await supabase.from("matches").insert(schedule);
  if (matchesErr) throw matchesErr;

  const { error: eventErr } = await supabase.from("events").update({ status: "active" }).eq("id", eventId);
  if (eventErr) throw eventErr;
}

export interface GoalEntry {
  scorer_id: string;
  assister_id: string | null;
  is_own_goal: boolean;
}

/** Records a match's goals, closes the match, and refreshes team standings (spec §9-10). */
export async function submitMatchResult(eventId: string, matchId: string, goals: GoalEntry[]) {
  if (goals.length > 0) {
    const { error: goalsErr } = await supabase.from("goals").insert(goals.map((g) => ({ ...g, match_id: matchId })));
    if (goalsErr) throw goalsErr;
  }

  const { error: matchErr } = await supabase.from("matches").update({ status: "finished" }).eq("id", matchId);
  if (matchErr) throw matchErr;

  await refreshStandings(eventId);
}

/** Recomputes team points/place from all finished matches so far — safe to call after every result. */
export async function refreshStandings(eventId: string) {
  const [{ data: teams, error: teamsErr }, { data: matches, error: matchesErr }] = await Promise.all([
    supabase.from("teams").select("*").eq("event_id", eventId),
    supabase.from("matches").select("*").eq("event_id", eventId),
  ]);
  if (teamsErr) throw teamsErr;
  if (matchesErr) throw matchesErr;

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: goals, error: goalsErr } = await supabase.from("goals").select("*").in("match_id", matchIds);
  if (goalsErr) throw goalsErr;

  const { data: players, error: playersErr } = await supabase
    .from("event_players")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "selected");
  if (playersErr) throw playersErr;

  const goalsByMatch: Record<string, Goal[]> = {};
  for (const g of goals ?? []) {
    (goalsByMatch[g.match_id] ??= []).push(g);
  }
  const playersByTeam: Record<string, Set<string>> = {};
  for (const p of players ?? []) {
    if (!p.team_id) continue;
    (playersByTeam[p.team_id] ??= new Set()).add(p.user_id);
  }

  const standings = computeStandings(teams ?? [], matches ?? [], goalsByMatch, playersByTeam);
  await Promise.all(
    standings.map((t) => supabase.from("teams").update({ points: t.points, place: t.place }).eq("id", t.id))
  );

  return { teams: standings, matches: matches ?? [], goalsByMatch, players: players ?? [] };
}

/**
 * Closes the tournament: finalizes standings, writes player_stats + PEI for the
 * event, then recomputes each involved player's global rating (spec §12-13).
 */
export async function finishTournament(eventId: string) {
  const { teams, matches, goalsByMatch, players } = await refreshStandings(eventId);

  const statLines = computePlayerStatsForEvent(players, matches, goalsByMatch);
  const placeByTeam = Object.fromEntries(teams.map((t) => [t.id, t.place]));

  const statsRows = statLines.map((line) => ({
    event_id: eventId,
    user_id: line.user_id,
    team_id: line.team_id,
    goals: line.goals,
    assists: line.assists,
    matches_played: line.matches_played,
    wins: line.wins,
    draws: line.draws,
    losses: line.losses,
    clean_sheets: line.clean_sheets,
    pei: computePei({
      goals: line.goals,
      assists: line.assists,
      matchesWithoutLosses: line.wins + line.draws,
      teamPlace: placeByTeam[line.team_id] ?? null,
    }),
  }));

  if (statsRows.length > 0) {
    const { error } = await supabase.from("player_stats").upsert(statsRows, { onConflict: "event_id,user_id" });
    if (error) throw error;
  }

  const { error: eventErr } = await supabase.from("events").update({ status: "finished" }).eq("id", eventId);
  if (eventErr) throw eventErr;

  await Promise.all(statsRows.map((row) => updateGlobalRating(row.user_id)));
}

/** spec §13: recompute a player's global rating from their full PEI history, oldest first. */
async function updateGlobalRating(userId: string) {
  const { data: history, error } = await supabase
    .from("player_stats")
    .select("pei, event:events(date)")
    .eq("user_id", userId);
  if (error) throw error;

  type HistoryRow = { pei: number; event: { date: string } | { date: string }[] | null };
  const peiHistory = (history as HistoryRow[] | null ?? [])
    .map((r) => ({
      pei: r.pei,
      date: Array.isArray(r.event) ? r.event[0]?.date : r.event?.date,
    }))
    .filter((r) => !!r.date)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
    .map((r) => r.pei);
  const rating = computeGlobalRating(peiHistory);

  const { error: userErr } = await supabase.from("users").update({ current_rating: rating }).eq("id", userId);
  if (userErr) throw userErr;
}