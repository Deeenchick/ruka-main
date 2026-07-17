// Hand-written to match supabase/schema.sql.
// Once your Supabase project is linked, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
//
// NOTE: every Row/Insert/Update below is a `type`, not an `interface`. Interfaces
// don't satisfy supabase-js's internal `Record<string, unknown>` constraint check
// (a TS quirk: "open"/mergeable interface declarations aren't structurally
// assignable to index-signature types the way closed type aliases are), which
// silently collapses every `.from(...)` call's generics to `never`.

export type VoteAnswer = "yes" | "maybe" | "no";
export type RosterVoteAnswer = "keep" | "change";
export type EventStatus = "voting" | "forming" | "active" | "finished";
export type PlayerStatus = "selected" | "reserve" | "declined";
export type MatchStatus = "pending" | "in_progress" | "finished";
export type TeamName = "A" | "B" | "C";

export type UsersRow = {
  id: string;
  login: string;
  name: string;
  password_hash: string;
  is_admin: boolean;
  current_rating: number;
  avatar_url: string | null;
  created_at: string;
};
export type UsersInsert = Partial<UsersRow> & {
  login: string;
  name: string;
  password_hash?: string;
};
export type UsersUpdate = Partial<UsersRow>;

export type EventsRow = {
  id: string;
  date: string;
  time: string;
  status: EventStatus;
  created_at: string;
};
export type EventsInsert = Partial<EventsRow> & {
  date: string;
  time: string;
};
export type EventsUpdate = Partial<EventsRow>;

export type VotesRow = {
  id: string;
  event_id: string;
  user_id: string;
  answer: VoteAnswer;
  created_at: string;
  updated_at: string;
};
export type VotesInsert = Partial<VotesRow> & {
  event_id: string;
  user_id: string;
  answer: VoteAnswer;
};
export type VotesUpdate = Partial<VotesRow>;

export type TeamsRow = {
  id: string;
  event_id: string;
  name: TeamName;
  points: number;
  place: number | null;
};
export type TeamsInsert = Partial<TeamsRow> & {
  event_id: string;
  name: TeamName;
};
export type TeamsUpdate = Partial<TeamsRow>;

export type EventPlayersRow = {
  id: string;
  event_id: string;
  user_id: string;
  team_id: string | null;
  status: PlayerStatus;
};
export type EventPlayersInsert = Partial<EventPlayersRow> & {
  event_id: string;
  user_id: string;
};
export type EventPlayersUpdate = Partial<EventPlayersRow>;

export type MatchesRow = {
  id: string;
  event_id: string;
  team_home_id: string;
  team_away_id: string;
  round: number;
  status: MatchStatus;
};
export type MatchesInsert = Partial<MatchesRow> & {
  event_id: string;
  team_home_id: string;
  team_away_id: string;
  round: number;
};
export type MatchesUpdate = Partial<MatchesRow>;

export type GoalsRow = {
  id: string;
  match_id: string;
  scorer_id: string;
  assister_id: string | null;
  is_own_goal: boolean;
};
export type GoalsInsert = Partial<GoalsRow> & {
  match_id: string;
  scorer_id: string;
};
export type GoalsUpdate = Partial<GoalsRow>;

export type PlayerStatsRow = {
  id: string;
  event_id: string;
  user_id: string;
  team_id: string;
  goals: number;
  assists: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets: number;
  pei: number;
};
export type PlayerStatsInsert = Partial<PlayerStatsRow> & {
  event_id: string;
  user_id: string;
  team_id: string;
};
export type PlayerStatsUpdate = Partial<PlayerStatsRow>;

export type RosterVotesRow = {
  id: string;
  event_id: string;
  user_id: string;
  answer: RosterVoteAnswer;
  created_at: string;
  updated_at: string;
};
export type RosterVotesInsert = Partial<RosterVotesRow> & {
  event_id: string;
  user_id: string;
  answer: RosterVoteAnswer;
};
export type RosterVotesUpdate = Partial<RosterVotesRow>;

export type Database = {
  public: {
    Tables: {
      users: { Row: UsersRow; Insert: UsersInsert; Update: UsersUpdate; Relationships: [] };
      events: { Row: EventsRow; Insert: EventsInsert; Update: EventsUpdate; Relationships: [] };
      votes: {
        Row: VotesRow;
        Insert: VotesInsert;
        Update: VotesUpdate;
        Relationships: [
          {
            foreignKeyName: "votes_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: { Row: TeamsRow; Insert: TeamsInsert; Update: TeamsUpdate; Relationships: [] };
      event_players: {
        Row: EventPlayersRow;
        Insert: EventPlayersInsert;
        Update: EventPlayersUpdate;
        Relationships: [
          {
            foreignKeyName: "event_players_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: { Row: MatchesRow; Insert: MatchesInsert; Update: MatchesUpdate; Relationships: [] };
      goals: { Row: GoalsRow; Insert: GoalsInsert; Update: GoalsUpdate; Relationships: [] };
      player_stats: {
        Row: PlayerStatsRow;
        Insert: PlayerStatsInsert;
        Update: PlayerStatsUpdate;
        Relationships: [
          {
            foreignKeyName: "player_stats_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_stats_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      roster_votes: {
        Row: RosterVotesRow;
        Insert: RosterVotesInsert;
        Update: RosterVotesUpdate;
        Relationships: [
          {
            foreignKeyName: "roster_votes_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roster_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};