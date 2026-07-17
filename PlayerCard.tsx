import type { Goal, User } from "@/lib/types";

interface Props {
  goals: Goal[];
  homePlayers: User[];
  awayPlayers: User[];
}

export function MatchGoalsList({ goals, homePlayers, awayPlayers }: Props) {
  const allPlayers = [...homePlayers, ...awayPlayers];
  const nameOf = (userId: string) => allPlayers.find((p) => p.id === userId)?.name ?? "?";

  if (goals.length === 0) {
    return <p className="text-sm text-muted-foreground">Голов не было</p>;
  }

  return (
    <ul className="space-y-1 rounded-md border bg-secondary/30 p-2">
      {goals.map((g) => (
        <li key={g.id} className="text-sm">
          ⚽ {g.is_own_goal ? "(авт.) " : ""}
          {nameOf(g.scorer_id)}
          {g.assister_id && <span className="text-muted-foreground"> 🤝 {nameOf(g.assister_id)}</span>}
        </li>
      ))}
    </ul>
  );
}