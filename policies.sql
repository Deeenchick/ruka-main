import type { Database } from "./database.types";

export type { VoteAnswer, EventStatus, PlayerStatus, MatchStatus, TeamName, RosterVoteAnswer } from "./database.types";

export type User = Database["public"]["Tables"]["users"]["Row"];
export type Event = Database["public"]["Tables"]["events"]["Row"];
export type Vote = Database["public"]["Tables"]["votes"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type EventPlayer = Database["public"]["Tables"]["event_players"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type PlayerStats = Database["public"]["Tables"]["player_stats"]["Row"];
export type RosterVote = Database["public"]["Tables"]["roster_votes"]["Row"];

export type VoteWithUser = Vote & { user: User };

export type TeamWithPlayers = Team & {
  players: (EventPlayer & { user: User })[];
  averageRating: number;
};

export type MatchWithGoals = Match & {
  goals: Goal[];
  home_score: number;
  away_score: number;
};