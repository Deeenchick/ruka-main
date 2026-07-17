import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { TEAM_LABEL } from "@/lib/teamLabels";
import type { EventPlayer, Team, User } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outUser: User | null;
  currentTeamId: string | null;
  allUsers: User[];
  eventPlayers: EventPlayer[];
  teams: Team[];
  isPending: boolean;
  onConfirm: (inUser: User) => void;
}

/** Small status tag next to each candidate: which team they're on, reserve, declined, or free. */
function candidateTag(userId: string, eventPlayers: EventPlayer[], teams: Team[]): string | null {
  const row = eventPlayers.find((p) => p.user_id === userId);
  if (!row) return null;
  if (row.status === "selected") {
    const team = teams.find((t) => t.id === row.team_id);
    return team ? `В команде ${TEAM_LABEL[team.name]}` : "В команде";
  }
  if (row.status === "reserve") return "Резерв";
  if (row.status === "declined") return "Отказался";
  return null;
}

export function PlayerPickerDialog({
  open,
  onOpenChange,
  outUser,
  currentTeamId,
  allUsers,
  eventPlayers,
  teams,
  isPending,
  onConfirm,
}: Props) {
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers
      .filter((u) => u.id !== outUser?.id)
      // No point offering a player who's already in this same team.
      .filter((u) => {
        const row = eventPlayers.find((p) => p.user_id === u.id);
        return !(row?.status === "selected" && row.team_id === currentTeamId);
      })
      .filter((u) => !q || u.name.toLowerCase().includes(q))
      .sort((a, b) => {
        // Free / reserve players float to the top, players already selected elsewhere go last.
        const aSelected = eventPlayers.find((p) => p.user_id === a.id)?.status === "selected";
        const bSelected = eventPlayers.find((p) => p.user_id === b.id)?.status === "selected";
        if (aSelected !== bSelected) return aSelected ? 1 : -1;
        return b.current_rating - a.current_rating;
      });
  }, [allUsers, outUser, currentTeamId, search, eventPlayers]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch("");
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col">
        <DialogHeader>
          <DialogTitle>Заменить игрока</DialogTitle>
          <DialogDescription>
            {outUser ? (
              <>
                Вместо <b>{outUser.name}</b> — выберите игрока из базы.
              </>
            ) : (
              "Выберите игрока"
            )}
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Поиск по имени…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="-mx-1 mt-2 flex-1 space-y-1 overflow-y-auto px-1">
          {candidates.length === 0 && (
            <p className="p-3 text-center text-sm text-muted-foreground">Никого не нашлось</p>
          )}
          {candidates.map((u) => {
            const tag = candidateTag(u.id, eventPlayers, teams);
            return (
              <button
                key={u.id}
                disabled={isPending}
                onClick={() => onConfirm(u)}
                className="flex w-full items-center gap-3 rounded-md p-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
              >
                <Avatar src={u.avatar_url} name={u.name} size={28} />
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                {tag && <span className="shrink-0 text-xs text-muted-foreground">{tag}</span>}
                <span className="shrink-0 text-xs text-muted-foreground">⭐ {u.current_rating.toFixed(1)}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}