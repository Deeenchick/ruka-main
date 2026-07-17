import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { submitMatchResult, type GoalEntry } from "@/lib/adminActions";
import { Button } from "@/components/ui/button";
import type { Match, User } from "@/lib/types";

interface Props {
  eventId: string;
  match: Match;
  homeTeamName: string;
  awayTeamName: string;
  homePlayers: User[];
  awayPlayers: User[];
  onDone: () => void;
}

/** Goals are entered as a running list right inside the match card — pick
 * scorer, optionally pick assist, tap "+", repeat, then finish. */
export function InlineGoalEntry({ eventId, match, homeTeamName, awayTeamName, homePlayers, awayPlayers, onDone }: Props) {
  const queryClient = useQueryClient();
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [scorerId, setScorerId] = useState("");
  const [assisterId, setAssisterId] = useState("");

  const allPlayers = useMemo(() => [...homePlayers, ...awayPlayers], [homePlayers, awayPlayers]);
  const homeIds = useMemo(() => new Set(homePlayers.map((p) => p.id)), [homePlayers]);
  const teammatesOfScorer = useMemo(() => {
    if (!scorerId) return [];
    const pool = homeIds.has(scorerId) ? homePlayers : awayPlayers;
    return pool.filter((p) => p.id !== scorerId);
  }, [scorerId, homeIds, homePlayers, awayPlayers]);

  const submit = useMutation({
    mutationFn: () => submitMatchResult(eventId, match.id, goals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", eventId] });
      queryClient.invalidateQueries({ queryKey: ["teams", eventId] });
      queryClient.invalidateQueries({ queryKey: ["goals", eventId] });
      onDone();
    },
  });

  function addGoal() {
    if (!scorerId) return;
    setGoals((prev) => [...prev, { scorer_id: scorerId, assister_id: assisterId || null, is_own_goal: false }]);
    setScorerId("");
    setAssisterId("");
  }

  function removeGoal(index: number) {
    setGoals((prev) => prev.filter((_, i) => i !== index));
  }

  function nameOf(userId: string) {
    return allPlayers.find((p) => p.id === userId)?.name ?? "?";
  }

  return (
    <div className="space-y-2 rounded-md border bg-secondary/30 p-3">
      <div className="space-y-1">
        {goals.map((g, i) => (
          <div key={i} className="flex items-center justify-between rounded-md bg-background px-2 py-1 text-sm">
            <span>
              ⚽ {nameOf(g.scorer_id)}
              {g.assister_id && <span className="text-muted-foreground"> 🤝 {nameOf(g.assister_id)}</span>}
            </span>
            <button onClick={() => removeGoal(i)} aria-label="Удалить гол">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ))}
        {goals.length === 0 && <p className="text-xs text-muted-foreground">Голов пока нет</p>}
      </div>

      <div className="flex items-center gap-2">
        <select
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          value={scorerId}
          onChange={(e) => {
            setScorerId(e.target.value);
            setAssisterId("");
          }}
        >
          <option value="">⚽️ гол забил</option>
          <optgroup label={homeTeamName}>
            {homePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={awayTeamName}>
            {awayPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        </select>

        {scorerId && (
          <select
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
            value={assisterId}
            onChange={(e) => setAssisterId(e.target.value)}
          >
            <option value="">🤝 без паса</option>
            {teammatesOfScorer.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <Button size="sm" variant="outline" className="shrink-0" disabled={!scorerId} onClick={addGoal}>
          +
        </Button>
      </div>

      <Button className="w-full" variant="outline" size="sm" disabled={submit.isPending} onClick={() => submit.mutate()}>
        {submit.isPending ? "Сохраняем…" : "Завершить матч"}
      </Button>
      {submit.isError && <p className="text-xs text-destructive">Не удалось сохранить результат</p>}
    </div>
  );
}