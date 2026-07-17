import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { VoteAnswer, VoteWithUser } from "@/lib/types";

const OPTIONS: { value: VoteAnswer; label: string; icon: string }[] = [
  { value: "yes", label: "Приду", icon: "✅" },
  { value: "maybe", label: "Думаю", icon: "🤔" },
  { value: "no", label: "Нет", icon: "❌" },
];

const ICON: Record<VoteAnswer, string> = { yes: "✅", maybe: "🤔", no: "❌" };
const LABEL: Record<VoteAnswer, string> = { yes: "Приду", maybe: "Думаю", no: "Нет" };

function voteTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  myVote?: VoteWithUser;
  votes: VoteWithUser[];
  onVote: (answer: VoteAnswer) => void;
  isPending: boolean;
  currentUserId?: string;
}

export function VotingPanel({ myVote, votes, onVote, isPending, currentUserId }: Props) {
  const [revoting, setRevoting] = useState(false);
  const showButtons = !myVote || revoting;

  // Sorted by updated_at, same as selectPlayerPool in draft.ts — the queue
  // is by last action, so revoting sends you to the back of the line for
  // your new answer instead of keeping your original spot.
  const groups = OPTIONS.map((opt) => ({
    ...opt,
    voters: votes.filter((v) => v.answer === opt.value).sort((a, b) => a.updated_at.localeCompare(b.updated_at)),
  }));

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className={showButtons ? "space-y-3 p-4" : "flex items-center justify-between p-3"}>
          {showButtons ? (
            <>
              <p className="text-sm font-medium">Придёшь на игру?</p>
              <div className="flex gap-2">
                {OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={myVote?.answer === opt.value ? "default" : "outline"}
                    disabled={isPending}
                    className="flex-1"
                    onClick={() => {
                      // Re-picking the same answer while revoting is a no-op —
                      // treat it as "cancel" instead of touching updated_at.
                      if (opt.value !== myVote?.answer) onVote(opt.value);
                      setRevoting(false);
                    }}
                  >
                    {opt.icon} {opt.label}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">
                <span className="font-semibold">{ICON[myVote!.answer]} {LABEL[myVote!.answer]}</span>
              </p>
              <Button size="sm" variant="ghost" onClick={() => setRevoting(true)}>
                Переголосовать
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {votes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Пока нет голосов</p>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {groups.map((g) =>
              g.voters.length === 0 ? null : (
                <div key={g.value} className="p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    {g.icon} {g.label} · {g.voters.length}
                  </p>
                  <div className="space-y-1.5">
                    {g.voters.map((v, i) => (
                      <div key={v.id}>
                        {g.value === "yes" && i === 15 && (
                          <div className="my-1.5 flex items-center gap-2">
                            <span className="h-px flex-1 bg-border" />
                            <span className="text-[11px] text-muted-foreground">резерв</span>
                            <span className="h-px flex-1 bg-border" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex items-center justify-between -mx-2 px-2 py-0.5 text-sm",
                            v.user.id === currentUserId && "bg-primary/10"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Avatar src={v.user.avatar_url} name={v.user.name} size={24} />
                            <span className="truncate">{v.user.name}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{voteTime(v.updated_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}