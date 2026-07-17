import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { RosterVoteAnswer } from "@/lib/types";

const OPTIONS: { value: RosterVoteAnswer; label: string; icon: string }[] = [
  { value: "keep", label: "Оставляем", icon: "👍" },
  { value: "change", label: "Меняем", icon: "🔄" },
];

interface Props {
  myVote?: RosterVoteAnswer;
  counts: Record<RosterVoteAnswer, number>;
  onVote: (answer: RosterVoteAnswer) => void;
  isPending: boolean;
}

/** Informational poll on the current split, shown after teams are formed —
 * only rendered for players actually on a team, since it's their call.
 * Results are just a count for everyone to see; the admin decides what
 * (if anything) to do about it. */
export function RosterVotePanel({ myVote, counts, onVote, isPending }: Props) {
  const [revoting, setRevoting] = useState(false);
  const total = counts.keep + counts.change;
  const showButtons = !myVote || revoting;
  // Don't see results until you've cast your own vote.
  const showResults = !!myVote;
  const showRevote = !!myVote && !revoting;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">Что делаем с составом?</p>

        {showButtons && (
          <div className="flex gap-2">
            {OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={myVote === opt.value ? "default" : "outline"}
                disabled={isPending}
                className="flex-1"
                onClick={() => {
                  // Re-picking the same answer while revoting is a no-op —
                  // treat it as "cancel" instead of touching updated_at.
                  if (opt.value !== myVote) onVote(opt.value);
                  setRevoting(false);
                }}
              >
                {opt.icon} {opt.label}
              </Button>
            ))}
          </div>
        )}

        {showResults && (
          <div className="flex items-center justify-between">
            {total === 0 ? (
              <p className="text-xs text-muted-foreground">Пока никто не проголосовал</p>
            ) : (
              <div className="flex gap-4 text-sm text-muted-foreground">
                {OPTIONS.map((opt) => (
                  <span key={opt.value}>
                    {opt.icon} {opt.label}: <span className="font-semibold text-foreground">{counts[opt.value]}</span>
                  </span>
                ))}
              </div>
            )}
            {showRevote && (
              <button
                type="button"
                aria-label="Переголосовать"
                onClick={() => setRevoting(true)}
                className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}