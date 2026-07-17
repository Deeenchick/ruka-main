#!/usr/bin/env node
// Imports historical tournament stats (from the "История 26" Google Sheet tab)
// into player_stats — one event+3 teams per date, one player_stats row per
// player. No matches/goals rows are created (not needed: rating only reads
// player_stats), so this is a lightweight backfill.
//
// PEI is NOT copied from the sheet — it's recomputed with our current
// formula (src/lib/pei.ts) from goals/assists/wins/draws/place, so historical
// and future PEI stay on the same scale when averaged into current_rating.
//
// clean_sheets isn't in the sheet (only per-tournament team goals-against,
// not per-match), so it's imported as 0 for all historical rows. This does
// NOT affect PEI (the current formula doesn't use clean_sheets), it only
// means the "clean sheets" stat on old tournaments will under-report.
//
// Requires the SERVICE ROLE key (not the anon key) since this writes
// directly to events/teams/player_stats, bypassing the app's normal
// admin-session RLS checks — appropriate for a one-off local backfill only.
// NEVER commit the service role key or put it in .env.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/import-history.mjs
//   (or just run it — it'll prompt for the key, input hidden)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const YEAR = 2026; // dates in the sheet have no year — confirmed with the user.
const TEAM_LETTER_MAP = { А: "A", Б: "B", В: "C" }; // Cyrillic -> our check-constraint letters

// --- mirrors src/lib/pei.ts exactly — keep in sync if that formula changes ---
function computePei({ goals, assists, matchesWithoutLosses, teamPlace }) {
  const base = ((goals * 1.1 + assists * 1.0) / 8) * 3.0;
  const placeBonus = teamPlace === 1 ? 2 : teamPlace === 2 ? 1 : teamPlace === 3 ? 0.3 : 0;
  const noLossBonus = matchesWithoutLosses * 0.12;
  const goalStreakBonus = Math.max(0, (goals - 4) * 0.08);
  const assistStreakBonus = Math.max(0, (assists - 3) * 0.12);
  const total = base + placeBonus + noLossBonus + goalStreakBonus + assistStreakBonus;
  return Math.round(Math.min(10, total) * 100) / 100;
}

// --- mirrors src/lib/rating.ts computeGlobalRating exactly ---
function computeGlobalRating(peiHistoryChronological) {
  if (peiHistoryChronological.length === 0) return 2.5;
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  if (peiHistoryChronological.length <= 3) return Math.round(avg(peiHistoryChronological) * 100) / 100;
  const last3 = peiHistoryChronological.slice(-3);
  const rating = 0.7 * avg(peiHistoryChronological) + 0.3 * avg(last3);
  return Math.round(rating * 100) / 100;
}

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    console.error("Не найден .env в корне проекта.");
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

async function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    let input = "";
    const onData = (char) => {
      char = char.toString();
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(input);
      } else if (char === "\u0003") {
        process.exit(1);
      } else if (char === "\u007f") {
        input = input.slice(0, -1);
      } else {
        input += char;
      }
    };
    stdin.on("data", onData);
  });
}

function parseCsv() {
  const csvPath = path.join(__dirname, "history-import.csv");
  if (!existsSync(csvPath)) {
    console.error("Не найден scripts/history-import.csv.");
    process.exit(1);
  }
  const rows = [];
  for (const raw of readFileSync(csvPath, "utf-8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [dateDdMm, player, teamLetter, goals, assists, matchesPlayed, teamPlace, wins, draws, losses] =
      line.split(",");
    const [dd, mm] = dateDdMm.split(".");
    rows.push({
      date: `${YEAR}-${mm}-${dd}`,
      player: player.trim(),
      team: TEAM_LETTER_MAP[teamLetter.trim()] ?? teamLetter.trim(),
      goals: Number(goals),
      assists: Number(assists),
      matchesPlayed: Number(matchesPlayed),
      teamPlace: Number(teamPlace),
      wins: Number(wins),
      draws: Number(draws),
      losses: Number(losses),
    });
  }
  return rows;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  if (!url) {
    console.error("В .env нет VITE_SUPABASE_URL.");
    process.exit(1);
  }

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || (await promptHidden("Service role key (Project Settings → API): "));
  const supabase = createClient(url, serviceKey);

  const rows = parseCsv();
  console.log(`Прочитал ${rows.length} строк из history-import.csv.\n`);

  // --- resolve player names to existing user ids up front, fail loudly on misses ---
  const { data: users, error: usersErr } = await supabase.from("users").select("id, name");
  if (usersErr) {
    console.error("Не смог прочитать users:", usersErr.message);
    process.exit(1);
  }
  const userIdByName = new Map(users.map((u) => [u.name.trim(), u.id]));

  const missingNames = [...new Set(rows.map((r) => r.player))].filter((name) => !userIdByName.has(name));
  if (missingNames.length > 0) {
    console.error("Эти имена из таблицы не нашлись в users.name — сначала поправь их (в БД или в CSV):");
    for (const n of missingNames) console.error(`  "${n}"`);
    process.exit(1);
  }

  // --- group rows by date -> one event per date ---
  const byDate = new Map();
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  }

  const touchedUserIds = new Set();

  for (const [date, dateRows] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`Турнир ${date}...`);

    // --- reuse the event if this date was already (fully or partially) imported ---
    let eventId;
    const { data: existingEvent, error: existingEventErr } = await supabase
      .from("events")
      .select("id")
      .eq("date", date)
      .maybeSingle();
    if (existingEventErr) {
      console.error(`  ошибка проверки турнира: ${existingEventErr.message}`);
      continue;
    }
    if (existingEvent) {
      eventId = existingEvent.id;
      console.log(`  турнир уже существует, дозаписываю недостающих игроков`);
    } else {
      const { data: event, error: eventErr } = await supabase
        .from("events")
        .insert({ date, time: "00:00", status: "finished" })
        .select("id")
        .single();
      if (eventErr) {
        console.error(`  ошибка создания турнира: ${eventErr.message}`);
        continue;
      }
      eventId = event.id;
    }

    // --- reuse existing teams for this event, create only missing letters ---
    const { data: existingTeams, error: existingTeamsErr } = await supabase
      .from("teams")
      .select("id, name")
      .eq("event_id", eventId);
    if (existingTeamsErr) {
      console.error(`  ошибка проверки команд: ${existingTeamsErr.message}`);
      continue;
    }
    const teamIdByLetter = new Map((existingTeams ?? []).map((t) => [t.name, t.id]));

    const letters = [...new Set(dateRows.map((r) => r.team))];
    for (const letter of letters) {
      if (teamIdByLetter.has(letter)) continue;
      const place = dateRows.find((r) => r.team === letter).teamPlace;
      const { data: team, error: teamErr } = await supabase
        .from("teams")
        .insert({ event_id: eventId, name: letter, place })
        .select("id")
        .single();
      if (teamErr) {
        console.error(`  ошибка создания команды ${letter}: ${teamErr.message}`);
        continue;
      }
      teamIdByLetter.set(letter, team.id);
    }

    // --- skip players who already have a player_stats row for this event ---
    const { data: existingStats, error: existingStatsErr } = await supabase
      .from("player_stats")
      .select("user_id")
      .eq("event_id", eventId);
    if (existingStatsErr) {
      console.error(`  ошибка проверки статистики: ${existingStatsErr.message}`);
      continue;
    }
    const alreadyImported = new Set((existingStats ?? []).map((s) => s.user_id));

    const newRows = dateRows.filter((r) => !alreadyImported.has(userIdByName.get(r.player)));
    if (newRows.length === 0) {
      console.log(`  всё уже загружено, пропускаю`);
      continue;
    }

    const statsRows = newRows.map((r) => {
      const pei = computePei({
        goals: r.goals,
        assists: r.assists,
        matchesWithoutLosses: r.wins + r.draws,
        teamPlace: r.teamPlace,
      });
      touchedUserIds.add(userIdByName.get(r.player));
      return {
        event_id: eventId,
        user_id: userIdByName.get(r.player),
        team_id: teamIdByLetter.get(r.team),
        goals: r.goals,
        assists: r.assists,
        matches_played: r.matchesPlayed,
        wins: r.wins,
        draws: r.draws,
        losses: r.losses,
        clean_sheets: 0,
        pei,
      };
    });

    const { error: statsErr } = await supabase.from("player_stats").insert(statsRows);
    if (statsErr) {
      console.error(`  ошибка записи статистики: ${statsErr.message}`);
      continue;
    }
    console.log(`  ок: ${statsRows.length} новых игроков (пропущено уже загруженных: ${dateRows.length - newRows.length})`);
  }

  // --- recompute current_rating for everyone touched, from their full history ---
  console.log(`\nПересчитываю рейтинг для ${touchedUserIds.size} игроков...`);
  for (const userId of touchedUserIds) {
    const { data: history, error } = await supabase
      .from("player_stats")
      .select("pei, event:events(date)")
      .eq("user_id", userId);
    if (error) {
      console.error(`  ${userId}: ${error.message}`);
      continue;
    }
    const peiHistory = history
      .map((r) => ({ pei: r.pei, date: Array.isArray(r.event) ? r.event[0]?.date : r.event?.date }))
      .filter((r) => !!r.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((r) => r.pei);
    const rating = computeGlobalRating(peiHistory);
    await supabase.from("users").update({ current_rating: rating }).eq("id", userId);
  }

  console.log("\nГотово.");
}

main();
