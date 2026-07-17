import type { User, VoteWithUser } from "./types";

const PLAYERS_NEEDED = 15;
const TEAM_NAMES = ["A", "B", "C"] as const;

/**
 * Picks the player pool for a tournament (spec §8):
 *  1. take the first 15 "yes" votes ordered by updated_at (last action —
 *     revoting sends you to the back of the queue for your new answer)
 *  2. if fewer than 15, fall back to "maybe" votes (also by updated_at) to fill the gap
 *  3. any further shortfall is left for manual admin add
 */
export function selectPlayerPool(votes: VoteWithUser[]): {
  selected: VoteWithUser[];
  reserve: VoteWithUser[];
} {
  const yes = votes.filter((v) => v.answer === "yes").sort(byUpdatedAt);
  const maybe = votes.filter((v) => v.answer === "maybe").sort(byUpdatedAt);

  const selected = yes.slice(0, PLAYERS_NEEDED);
  const shortfall = PLAYERS_NEEDED - selected.length;

  const promotedFromMaybe = shortfall > 0 ? maybe.slice(0, shortfall) : [];
  selected.push(...promotedFromMaybe);

  const reserve = [
    ...yes.slice(selected.length),
    ...maybe.filter((m) => !promotedFromMaybe.includes(m)),
  ];

  return { selected, reserve };
}

// Queue order is by *last action* on this answer, not when they first voted —
// so changing your mind sends you to the back of the line for the new answer,
// it doesn't preserve your original spot.
function byUpdatedAt(a: VoteWithUser, b: VoteWithUser) {
  return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
}

function byCreatedAt(a: VoteWithUser, b: VoteWithUser) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export interface DraftedTeam {
  name: (typeof TEAM_NAMES)[number];
  players: User[];
}

/**
 * Deals players in the order given, A-B-C-C-B-A-A-B-C... (snake pattern),
 * without re-sorting them first. Used directly when the caller already
 * controls the order (e.g. a reshuffled "Поделить заново" list).
 */
export function dealSnake(players: User[]): DraftedTeam[] {
  const teams: DraftedTeam[] = TEAM_NAMES.map((name) => ({ name, players: [] }));

  let teamIndex = 0;
  let direction: 1 | -1 = 1;
  for (const player of players) {
    teams[teamIndex].players.push(player);
    if (direction === 1 && teamIndex === teams.length - 1) {
      direction = -1;
    } else if (direction === -1 && teamIndex === 0) {
      direction = 1;
    } else {
      teamIndex += direction;
    }
  }
  return teams;
}

/**
 * Snake draft: sort players by rating desc, then deal them A-B-C-C-B-A-A-B-C...
 * so the three teams end up with balanced average rating.
 */
export function snakeDraft(players: User[]): DraftedTeam[] {
  const sorted = [...players].sort((a, b) => b.current_rating - a.current_rating);
  return dealSnake(sorted);
}

/**
 * "New variant" (spec §8): reshuffle among players whose ratings are close enough
 * to be considered interchangeable, without breaking the overall snake-draft balance.
 * `closeness` is the max rating delta considered "close" (default 0.3).
 */
export function shuffleCloseRatings(players: User[], closeness = 0.3): User[] {
  const sorted = [...players].sort((a, b) => b.current_rating - a.current_rating);
  const result = [...sorted];

  let i = 0;
  while (i < result.length) {
    let j = i;
    while (j + 1 < result.length && Math.abs(result[j + 1].current_rating - result[i].current_rating) <= closeness) {
      j++;
    }
    // shuffle the [i, j] cluster of close ratings
    for (let k = j; k > i; k--) {
      const swap = Math.floor(Math.random() * (k - i + 1)) + i;
      [result[k], result[swap]] = [result[swap], result[k]];
    }
    i = j + 1;
  }
  return result;
}

export function averageTeamRating(players: User[]): number {
  if (players.length === 0) return 0;
  const sum = players.reduce((acc, p) => acc + p.current_rating, 0);
  return Math.round((sum / players.length) * 100) / 100;
}
