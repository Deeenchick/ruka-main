import { useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { averageTeamRating } from "@/lib/draft";
import { TEAM_LABEL } from "@/lib/teamLabels";
import { cn } from "@/lib/utils";
import type { TeamName, User } from "@/lib/types";

interface Props {
  name: TeamName;
  players: User[];
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  defaultExpanded?: boolean;
  editable?: boolean;
  onEditPlayer?: (user: User) => void;
  currentUserId?: string;
}

export function TeamCard({
  name,
  players,
  points,
  goalsFor,
  goalsAgainst,
  defaultExpanded,
  editable,
  onEditPlayer,
  currentUserId,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const avg = averageTeamRating(players);
  const total = players.reduce((sum, p) => sum + p.current_rating, 0);
  const sorted = [...players].sort((a, b) => b.current_rating - a.current_rating);
  const showGoals = typeof goalsFor === "number" && typeof goalsAgainst === "number";

  return (
    <Card>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-4"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-3">
          <span className="font-semibold">{TEAM_LABEL[name]}</span>
          <span className="text-sm text-muted-foreground">
            ⭐️ {avg.toFixed(2)} / {total.toFixed(1)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {typeof points === "number" && (
            <span className="text-sm font-medium">
              {showGoals && (
                <span className="text-muted-foreground">
                  {goalsFor}-{goalsAgainst} /{" "}
                </span>
              )}
              {points} очк.
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </span>
      </button>

      {expanded && (
        <CardContent className="pt-0">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пусто</p>
          ) : (
            <ul className="space-y-1">
              {sorted.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1 -mx-2 text-sm",
                    p.id === currentUserId && "bg-primary/10"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar src={p.avatar_url} name={p.name} size={24} />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-muted-foreground">⭐ {p.current_rating.toFixed(1)}</span>
                    {editable && (
                      <button
                        type="button"
                        aria-label={`Заменить ${p.name}`}
                        onClick={() => onEditPlayer?.(p)}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}