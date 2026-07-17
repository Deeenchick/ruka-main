import type { TeamName } from "./types";

/** Team identifiers stay "A"/"B"/"C" in the database (schema check
 * constraint, snake draft, round-robin schedule, and seed scripts all key
 * off these Latin letters) — this is purely how they're displayed. */
export const TEAM_LABEL: Record<TeamName, string> = {
  A: "А",
  B: "Б",
  C: "В",
};

/** Display-only accent color per team, used where the team letter needs to
 * stand out (e.g. the results table's team column). */
export const TEAM_COLOR: Record<TeamName, string> = {
  A: "text-red-500",
  B: "text-sky-500",
  C: "text-green-500",
};