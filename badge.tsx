import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TEAM_LABEL, TEAM_COLOR } from "@/lib/teamLabels";
import { computeStandings, goalsToScore } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { MatchGoalsList } from "@/components/event/MatchGoalsList";
import type { Goal, Match, PlayerStats, Team, User } from "@/lib/types";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

type StatsRow = PlayerStats & { user: User };

interface Props {
  teams: Team[];
  stats: StatsRow[];
  matches: Match[];
  goalsByMatch: Record<string, Goal[]>;
  playersByTeam: Map<string, User[]>;
  currentUserId?: string;
}

export function ResultsView({ teams, stats, matches, goalsByMatch, playersByTeam, currentUserId }: Props) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const playerIdsByTeam: Record<string, Set<string>> = {};
  for (const [teamId, ps] of playersByTeam) {
    playerIdsByTeam[teamId] = new Set(ps.map((p) => p.id));
  }
  const standings = computeStandings(teams, matches, goalsByMatch, playerIdsByTeam);

  const mvp = stats.length > 0 ? [...stats].sort((a, b) => b.pei - a.pei)[0] : null;
  const topScorer = stats.length > 0 ? [...stats].sort((a, b) => b.goals - a.goals)[0] : null;
  const topAssist = stats.length > 0 ? [...stats].sort((a, b) => b.assists - a.assists)[0] : null;

  // Rank (by PEI, tournament-wide) is computed once and reused in both tabs —
  // "Команды" just re-groups the same ranking by team, it doesn't re-rank.
  const ranked = [...stats].sort((a, b) => b.pei - a.pei);
  const rankByUser = new Map(ranked.map((s, i) => [s.user_id, i + 1]));
  const maxGoals = stats.length > 0 ? Math.max(...stats.map((s) => s.goals)) : 0;
  const maxAssists = stats.length > 0 ? Math.max(...stats.map((s) => s.assists)) : 0;

  const teamsByPlace = [...teams].sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
  // Same rows as "Общая", just reordered so each team's players sit together
  // (still one table — not split into per-team tables).
  const groupedByTeam = teamsByPlace.flatMap((t) => ranked.filter((s) => s.team_id === t.id));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="overflow-x-auto p-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-6 pb-1"></th>
                <th className="pb-1">Команда</th>
                <th className="pb-1 text-center">В</th>
                <th className="pb-1 text-center">Н</th>
                <th className="pb-1 text-center">П</th>
                <th className="pb-1 text-center">ЗМ / ПМ</th>
                <th className="pb-1 text-right">Очки</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="py-1 text-lg leading-none">{t.place ? (MEDAL[t.place] ?? "") : ""}</td>
                  <td className="py-1 font-semibold">{TEAM_LABEL[t.name]}</td>
                  <td className="py-1 text-center">{t.wins}</td>
                  <td className="py-1 text-center">{t.draws}</td>
                  <td className="py-1 text-center">{t.losses}</td>
                  <td className="py-1 text-center">{t.goalsFor} / {t.goalsAgainst}</td>
                  <td className="py-1 text-right font-semibold">{t.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y p-0">
          <AwardRow icon="🏆" label="MVP" user={mvp?.user} value={mvp ? `${mvp.pei.toFixed(2)} PEI` : undefined} />
          <AwardRow icon="⚽" label="Бомбардир" user={topScorer?.user} value={topScorer ? `${topScorer.goals} гол.` : undefined} />
          <AwardRow icon="🤝" label="Ассистент" user={topAssist?.user} value={topAssist ? `${topAssist.assists} пас.` : undefined} />
        </CardContent>
      </Card>

      {ranked.length > 0 && (
        <Tabs defaultValue="overall">
          <TabsList className="w-full">
            <TabsTrigger value="overall" className="flex-1">Статистика</TabsTrigger>
            <TabsTrigger value="teams" className="flex-1">Команды</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">История</TabsTrigger>
          </TabsList>

          <TabsContent value="overall">
            <Card>
              <CardContent className="overflow-x-auto p-3">
                <PlayerTable
                  rows={ranked}
                  firstColLabel="№"
                  firstColValue={(s) => rankByUser.get(s.user_id)}
                  maxGoals={maxGoals}
                  maxAssists={maxAssists}
                  mvpId={mvp?.user_id}
                  topScorerId={topScorer?.user_id}
                  topAssistId={topAssist?.user_id}
                  currentUserId={currentUserId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams">
            <Card>
              <CardContent className="overflow-x-auto p-3">
                <PlayerTable
                  rows={groupedByTeam}
                  firstColLabel="К"
                  firstColValue={(s) => {
                    const team = teamById[s.team_id];
                    return team ? <span className={TEAM_COLOR[team.name]}>{TEAM_LABEL[team.name]}</span> : null;
                  }}
                  maxGoals={maxGoals}
                  maxAssists={maxAssists}
                  mvpId={mvp?.user_id}
                  topScorerId={topScorer?.user_id}
                  topAssistId={topAssist?.user_id}
                  currentUserId={currentUserId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-2">
            {matches.map((m) => {
              const home = teamById[m.team_home_id];
              const away = teamById[m.team_away_id];
              if (!home || !away) return null;
              const homePlayers = playersByTeam.get(home.id) ?? [];
              const awayPlayers = playersByTeam.get(away.id) ?? [];
              const matchGoals = goalsByMatch[m.id] ?? [];
              const { scoreA, scoreB } = goalsToScore(matchGoals, playerIdsByTeam[home.id] ?? new Set<string>());
              const isExpanded = expandedMatchId === m.id;

              return (
                <Card key={m.id}>
                  <button
                    onClick={() => setExpandedMatchId(isExpanded ? null : m.id)}
                    className="flex w-full items-center justify-between p-3 text-sm"
                  >
                    <span>
                      #{m.round} {TEAM_LABEL[home.name]}–{TEAM_LABEL[away.name]}
                    </span>
                    <span className="font-semibold">
                      {scoreA}-{scoreB}
                    </span>
                  </button>
                  {isExpanded && (
                    <CardContent className="px-3 pb-3 pt-0">
                      <MatchGoalsList goals={matchGoals} homePlayers={homePlayers} awayPlayers={awayPlayers} />
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function PlayerTable({
  rows,
  firstColLabel,
  firstColValue,
  maxGoals,
  maxAssists,
  mvpId,
  topScorerId,
  topAssistId,
  currentUserId,
}: {
  rows: StatsRow[];
  firstColLabel: string;
  firstColValue: (row: StatsRow) => ReactNode;
  maxGoals: number;
  maxAssists: number;
  mvpId?: string;
  topScorerId?: string;
  topAssistId?: string;
  currentUserId?: string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="w-8 pb-1">{firstColLabel}</th>
          <th className="pb-1">Игрок</th>
          <th className="pb-1 text-center">Г</th>
          <th className="pb-1 text-center">П</th>
          <th className="pb-1 text-right">PEI</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.user_id} className={cn("border-t", s.user_id === currentUserId && "bg-primary/10")}>
            <td className="py-1 text-muted-foreground">{firstColValue(s)}</td>
            <td className="py-1">
              <span className="flex items-center gap-1.5">
                <Avatar src={s.user.avatar_url} name={s.user.name} size={22} />
                <span className="truncate">{s.user.name}</span>
                {s.user_id === mvpId && <span title="MVP">🏆</span>}
                {s.user_id === topScorerId && <span title="Бомбардир">⚽</span>}
                {s.user_id === topAssistId && <span title="Ассистент">🤝</span>}
              </span>
            </td>
            <td
              className={cn(
                "py-1 text-center",
                maxGoals > 0 && s.goals === maxGoals && "font-semibold bg-green-100 text-green-600"
              )}
            >
              {s.goals}
            </td>
            <td
              className={cn(
                "py-1 text-center",
                maxAssists > 0 && s.assists === maxAssists && "font-semibold bg-green-100 text-green-600"
              )}
            >
              {s.assists}
            </td>
            <td className="py-1 text-right font-medium text-primary">{s.pei.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AwardRow({ icon, label, user, value }: { icon: string; label: string; user?: User; value?: string }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span className="text-xl">{icon}</span>
      {user && <Avatar src={user.avatar_url} name={user.name} size={28} />}
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{user?.name ?? "—"}</p>
      </div>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
    </div>
  );
}