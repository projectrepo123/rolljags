#!/usr/bin/env node
// Rebuilds the site's stat JSON from the four record-book spreadsheets.
//
//   node scripts/import-stats.mjs [--src <dir>] [--check]
//
// --src    directory holding the four .xlsx files (default: ~/Downloads)
// --check  validate and report without writing anything
//
// Writes public/data/history.json, public/data/records.json and
// public/data/records/{career,season,game}.json, then prints a reconciliation
// report. Exits non-zero if a season's game log disagrees with its team-stats
// row in a way that is not already known, or if a player name looks like an
// unmapped misspelling — those are signals the source changed and the alias
// tables in lib/normalize.mjs need a new entry.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkbook, isBlankRow } from "./lib/xlsx.mjs";
import {
  NAME_ALIASES,
  BARE_SURNAMES,
  AMBIGUOUS_NAMES,
  normalizeName,
  normalizeOpponent,
  isPlaceholderName,
  decodeRecordCell,
  parseScore,
  parseEvent,
  serialToDate,
  num,
  int,
  year as parseYear,
} from "./lib/normalize.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public", "data");

const FILES = {
  career: "All time Seckman Football Records- Career.xlsx",
  season: "Single Season Football Records.xlsx",
  game: "Single Game Individual Seckman Records.xlsx",
  team: "Team Season Records.xlsx",
};

// Discrepancies that live in the source spreadsheet itself: a season's
// team-stats row disagrees with that same season's game log. They are reported
// on every run but do not fail the build, because "fixing" either side would be
// inventing data. Values are [pointsFor, pointsAgainst] of gameLog minus
// teamStats. Every other season reconciles exactly.
const KNOWN_POINT_DISCREPANCIES = {
  // The team-stats row omits one game outright. In both cases the gap is
  // exactly that game's score: 2002 is missing Parkway North (42-8) and 2004 is
  // missing University City (52-51), while both records count all 10 games.
  2002: [8, 42],
  2004: [51, 52],
  // Points-against reconciles; points-for is short by the Farmington game,
  // where the sheet and history.json also disagree (6 vs 7).
  2007: [6, 0],
  // Points-for reconciles exactly; points-against is 3 high. The three games
  // the two sources disagree on for 2009 do not account for it either way.
  2009: [0, 3],
};

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes("--check");
const srcFlag = args.indexOf("--src");
const SRC = srcFlag !== -1 ? args[srcFlag + 1] : path.join(process.env.USERPROFILE || process.env.HOME, "Downloads");

const problems = [];
const notes = [];
const fail = (msg) => problems.push(msg);
const note = (msg) => notes.push(msg);

// --------------------------------------------------------------------- helpers

function loadSheets(key) {
  const file = path.join(SRC, FILES[key]);
  if (!fs.existsSync(file)) {
    console.error(`Missing source workbook: ${file}`);
    process.exit(1);
  }
  return readWorkbook(file);
}

function tab(sheets, name) {
  const want = name.trim().toLowerCase();
  const found = sheets.find((s) => s.name.trim().toLowerCase() === want);
  if (!found) throw new Error(`No tab "${name}" (have: ${sheets.map((s) => `"${s.name}"`).join(", ")})`);
  return found;
}

/** Data rows (header skipped, blanks dropped) as raw cell arrays. */
function dataRows(sheet, headerRows = 1) {
  return sheet.rows.slice(headerRows).filter((r) => !isBlankRow(r));
}

const seenNames = new Set();
let placeholderRows = 0;

function player(raw) {
  if (isPlaceholderName(raw)) {
    placeholderRows++;
    return "";
  }
  const name = normalizeName(raw);
  if (name) seenNames.add(name);
  return name;
}

/**
 * Second pass over every dataset that folds spellings differing only in case,
 * spacing or punctuation ("Ben lewis" -> "Ben Lewis") onto the form the
 * workbooks use most often. Doing it by frequency rather than by hand keeps the
 * alias table in normalize.mjs for genuine misspellings only.
 */
function canonicalizeNames(datasets) {
  const key = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  const counts = new Map();

  const eachRow = (fn) => {
    for (const dataset of datasets) {
      for (const rows of Object.values(dataset)) {
        for (const row of rows) fn(row);
      }
    }
  };

  eachRow((row) => {
    for (const field of ["name", "player"]) {
      if (!row[field]) continue;
      const k = key(row[field]);
      if (!counts.has(k)) counts.set(k, new Map());
      const forms = counts.get(k);
      forms.set(row[field], (forms.get(row[field]) ?? 0) + 1);
    }
  });

  const canonical = new Map();
  for (const [k, forms] of counts) {
    // Most frequent wins; ties broken alphabetically so runs are reproducible.
    const best = [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    canonical.set(k, best);
  }

  eachRow((row) => {
    for (const field of ["name", "player"]) {
      if (row[field]) row[field] = canonical.get(key(row[field])) ?? row[field];
    }
  });

  seenNames.clear();
  for (const name of canonical.values()) seenNames.add(name);
}

/** Drops rows where every stat is null — a name with no numbers is noise. */
function withStats(rows, statKeys) {
  return rows.filter((r) => statKeys.some((k) => r[k] !== null && r[k] !== undefined));
}

// ------------------------------------------------------------- career records

function buildCareer(sheets) {
  const rows = (name, headerRows = 1) => dataRows(tab(sheets, name), headerRows);
  const simple = (name) =>
    withStats(
      rows(name).map((r) => ({
        name: player(r[0]),
        attempts: int(r[1]),
        yards: int(r[2]),
        avg: num(r[3]),
      })),
      ["attempts", "yards", "avg"],
    ).filter((r) => r.name);

  return {
    scoring: withStats(
      rows(" Scoring").map((r) => ({
        name: player(r[0]),
        tds: int(r[1]),
        fgs: int(r[2]),
        twoPt: int(r[3]),
        onePt: int(r[4]),
        safety: int(r[5]),
        totalPoints: int(r[6]),
      })),
      ["tds", "fgs", "twoPt", "onePt", "safety", "totalPoints"],
    ).filter((r) => r.name),

    passing: withStats(
      rows("Passing").map((r) => ({
        name: player(r[0]),
        completions: int(r[1]),
        attempts: int(r[2]),
        pct: num(r[3]),
        yards: int(r[4]),
        tds: int(r[5]),
        ints: int(r[6]),
      })),
      ["completions", "attempts", "yards", "tds", "ints"],
    ).filter((r) => r.name),

    rushing: withStats(
      rows("Rushing").map((r) => ({
        name: player(r[0]),
        attempts: int(r[1]),
        yards: int(r[2]),
        tds: int(r[3]),
        avg: num(r[4]),
      })),
      ["attempts", "yards", "tds", "avg"],
    ).filter((r) => r.name),

    receiving: withStats(
      rows("Recieving ").map((r) => ({
        name: player(r[0]),
        receptions: int(r[1]),
        yards: int(r[2]),
        tds: int(r[3]),
        avg: num(r[4]),
      })),
      ["receptions", "yards", "tds", "avg"],
    ).filter((r) => r.name),

    totalYards: withStats(
      rows("Total Yards").map((r) => ({
        name: player(r[0]),
        rushing: int(r[1]),
        receiving: int(r[2]),
        total: int(r[3]),
      })),
      ["rushing", "receiving", "total"],
    ).filter((r) => r.name),

    defense: withStats(
      rows("Defensive Stats").map((r) => ({
        name: player(r[0]),
        tackles: int(r[1]),
        assists: int(r[2]),
        total: int(r[3]),
        sacks: int(r[4]),
        fumbleRec: int(r[5]),
        ints: int(r[6]),
        tds: int(r[7]),
      })),
      ["tackles", "assists", "total", "sacks", "fumbleRec", "ints", "tds"],
    ).filter((r) => r.name),

    kicking: simple("Kicking Stats"),
    punting: simple("Punting Stats"),
    kickReturn: simple("Kick Retun Stats"),
    puntReturn: simple("Punt Return"),
  };
}

// ------------------------------------------------- single-season records

function buildSeasonRecords(sheets) {
  const rows = (name) => dataRows(tab(sheets, name));

  // The five tabs below label their first column "#" and hold a mix of seasons
  // and jersey numbers. parseYear() returns null for anything that is not a
  // plausible season, and the UI shows those as "—" rather than dropping the row.
  const simple = (name, extra = null) =>
    withStats(
      rows(name).map((r) => {
        const row = {
          year: parseYear(r[0]),
          name: player(r[1]),
          attempts: int(r[2]),
          yards: int(r[3]),
          avg: num(r[4]),
        };
        if (extra) row[extra] = int(r[5]);
        return row;
      }),
      ["attempts", "yards", "avg"],
    ).filter((r) => r.name);

  // " Scoring" is a single column of "Cole Ruble -2022" with the separator
  // varying between "-", " - ", "- " and a bare space.
  const scoring = rows(" Scoring")
    .map((r) => {
      const raw = String(r[0] ?? "").replace(/\s+/g, " ").trim();
      const m = raw.match(/^(.*?)[\s-]*((?:19|20)\d{2})$/);
      return {
        player: player(m ? m[1].replace(/[-–]\s*$/, "") : raw),
        year: m ? parseInt(m[2], 10) : null,
        tds: int(r[1]),
      };
    })
    .filter((r) => r.player && r.tds !== null);

  return {
    scoring,

    passing: withStats(
      rows("Passing Stats").map((r) => ({
        year: parseYear(r[0]),
        name: player(r[1]),
        completions: int(r[2]),
        attempts: int(r[3]),
        pct: num(r[4]),
        yards: int(r[5]),
        tds: int(r[6]),
        ints: int(r[7]),
        rating: num(r[8]),
      })),
      ["completions", "attempts", "yards", "tds", "ints"],
    ).filter((r) => r.name),

    rushing: withStats(
      rows("Rushing").map((r) => ({
        year: parseYear(r[0]),
        name: player(r[1]),
        attempts: int(r[2]),
        yards: int(r[3]),
        tds: int(r[4]),
        avg: num(r[5]),
      })),
      ["attempts", "yards", "tds", "avg"],
    ).filter((r) => r.name),

    receiving: withStats(
      rows("Recieving ").map((r) => ({
        year: parseYear(r[0]),
        name: player(r[1]),
        receptions: int(r[2]),
        yards: int(r[3]),
        tds: int(r[4]),
        avg: num(r[5]),
      })),
      ["receptions", "yards", "tds", "avg"],
    ).filter((r) => r.name),

    totalYards: withStats(
      rows("Total Yards").map((r) => ({
        year: parseYear(r[0]),
        name: player(r[1]),
        rushing: int(r[2]),
        receiving: int(r[3]),
        total: int(r[4]),
      })),
      ["rushing", "receiving", "total"],
    ).filter((r) => r.name),

    defense: withStats(
      rows("Defensive Stats").map((r) => ({
        year: parseYear(r[0]),
        name: player(r[1]),
        tackles: int(r[2]),
        assists: int(r[3]),
        total: int(r[4]),
        sacks: int(r[5]),
        fumbleRec: int(r[6]),
        ints: int(r[7]),
        tds: int(r[8]),
      })),
      ["tackles", "assists", "total", "sacks", "fumbleRec", "ints", "tds"],
    ).filter((r) => r.name),

    kicking: simple("Kicking Stats", "xp"),
    punting: simple("Punting Stats"),
    kickReturn: simple("Kick Retun Stats"),
    puntReturn: simple("Punt Return"),
  };
}

// --------------------------------------------------- single-game records

/** Year + opponent + name are the first three columns of most single-game tabs. */
function gameHead(r, offset = 0) {
  const { opponent, playoff } = normalizeOpponent(r[offset + 1]);
  return { year: parseYear(r[offset]), opponent, playoff, name: player(r[offset + 2]) };
}

function buildGameRecords(sheets) {
  const rows = (name) => dataRows(tab(sheets, name));

  const turnovers = tab(sheets, "Turnovers").rows;
  const returns = tab(sheets, "Returns").rows;

  // "Turnovers" is two tables side by side (fumbles in A-D, interceptions in
  // F-I) with a third table starting partway down the left column, so it has to
  // be read by region rather than by a single header row.
  const fumbles = [];
  const returnTds = [];
  let leftMode = "fumbles";
  for (let i = 1; i < turnovers.length; i++) {
    const r = turnovers[i];
    if (isBlankRow(r)) continue;
    if (String(r[0]).trim() === "Year") {
      leftMode = "returnTds"; // the second left-hand header row
      continue;
    }
    if (!String(r[2] ?? "").trim()) continue;
    const row = { ...gameHead(r), [leftMode === "fumbles" ? "fumbles" : "yards"]: int(r[3]) };
    (leftMode === "fumbles" ? fumbles : returnTds).push(row);
  }

  const interceptions = [];
  for (let i = 1; i < turnovers.length; i++) {
    const r = turnovers[i];
    if (isBlankRow(r) || !String(r[7] ?? "").trim()) continue;
    interceptions.push({ ...gameHead(r, 5), ints: int(r[8]) });
  }

  // "Returns" holds punt-return TDs (A-D) beside kickoff-return TDs (F-I), then
  // punt-return yardage further down the left column. Its stat cells are prose:
  // "90 yards", "5 for 105".
  const yardsOf = (cell) => {
    const text = String(cell ?? "").trim();
    const forMatch = text.match(/(\d+)\s*for\s*(\d+)/i);
    if (forMatch) return { returns: parseInt(forMatch[1], 10), yards: parseInt(forMatch[2], 10) };
    const plain = text.match(/(\d+)/);
    return { returns: null, yards: plain ? parseInt(plain[1], 10) : null };
  };

  const returnTouchdowns = [];
  const puntReturnYards = [];
  let leftReturns = "td";
  for (let i = 2; i < returns.length; i++) {
    const r = returns[i];
    if (isBlankRow(r)) continue;
    if (/Punt Return Yards/i.test(String(r[0]))) {
      leftReturns = "yards";
      continue;
    }
    if (String(r[0]).trim() === "Year") continue;

    if (String(r[2] ?? "").trim()) {
      const parsed = yardsOf(r[3]);
      if (leftReturns === "td") {
        returnTouchdowns.push({ ...gameHead(r), type: "Punt", yards: parsed.yards });
      } else {
        puntReturnYards.push({ ...gameHead(r), returns: parsed.returns, yards: parsed.yards });
      }
    }
    if (String(r[7] ?? "").trim()) {
      returnTouchdowns.push({ ...gameHead(r, 5), type: "Kickoff", yards: yardsOf(r[8]).yards });
    }
  }

  return {
    touchdowns: rows("Touchdowns")
      .map((r) => ({ ...gameHead(r), tds: int(r[3]) }))
      .filter((r) => r.name && r.tds !== null),

    rushing: rows("Rushing ")
      .map((r) => ({ ...gameHead(r), yards: int(r[3]), attempts: int(r[4]), ypc: num(r[5]) }))
      .filter((r) => r.name && r.yards !== null),

    passing: rows("Passing ")
      .map((r) => ({
        ...gameHead(r),
        yards: int(r[3]),
        completions: int(r[4]),
        attempts: int(r[5]),
        tds: int(r[6]),
      }))
      .filter((r) => r.name && r.yards !== null),

    receiving: rows("Recieving")
      .map((r) => ({ ...gameHead(r), yards: int(r[3]), receptions: int(r[4]), tds: int(r[5]) }))
      .filter((r) => r.name && r.yards !== null),

    tackles: rows("Tackles")
      .map((r) => ({ ...gameHead(r), tackles: int(r[3]) }))
      .filter((r) => r.name && r.tackles !== null),

    sacks: rows("Sacks")
      .map((r) => ({ ...gameHead(r), sacks: int(r[3]) }))
      .filter((r) => r.name && r.sacks !== null),

    fumbles: fumbles.filter((r) => r.name && r.fumbles !== null),
    interceptions: interceptions.filter((r) => r.name && r.ints !== null),
    returnTds: returnTds.filter((r) => r.name),
    returnTouchdowns: returnTouchdowns.filter((r) => r.name),
    puntReturnYards: puntReturnYards.filter((r) => r.name),
  };
}

// ------------------------------------------------------------- team stats

// Columns that hold counting stats: a plain integer, or a string when the sheet
// appends a program rank like "523 (1)".
const TEAM_COUNT_COLS = {
  pf: 4,
  pa: 5,
  rushYds: 8,
  passYds: 10,
  totalYds: 12,
  defInt: 14,
  defFumbles: 15,
  turnovers: 16,
  sacks: 17,
};

// Per-game averages, always rendered as strings so "11.0" reads as "11".
const TEAM_RATE_COLS = { oppg: 6, dppg: 7, rushYpg: 9, passYpg: 11, totalYpg: 13 };

function rankSuffix(raw) {
  const m = String(raw ?? "").match(/\((\d+)\)\s*$/);
  return m ? ` (${m[1]})` : "";
}

function countCell(raw) {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (!text) return null;
  const rank = rankSuffix(text);
  const n = parseFloat(text);
  if (!Number.isFinite(n)) return text;
  return rank ? `${Math.round(n)}${rank}` : Math.round(n);
}

function rateCell(raw) {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (!text) return null;
  const rank = rankSuffix(text);
  const n = parseFloat(text);
  if (!Number.isFinite(n)) return text;
  // Drop a trailing ".0" so "11.0" matches the site's existing "11".
  return `${String(Number(n.toFixed(2)))}${rank}`;
}

function pctCell(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const rank = rankSuffix(text);
  const n = parseFloat(text);
  if (!Number.isFinite(n)) return text;
  return `${Math.round(n * 100)}%${rank}`;
}

function buildTeamStats(sheets) {
  const sheet = tab(sheets, "Team Stats");
  const seasons = [];

  for (const r of sheet.rows.slice(1)) {
    if (isBlankRow(r)) continue;
    const y = parseYear(r[0]);
    if (y === null) continue; // the trailing "Program" summary row

    // "Dankel (1-29) 3%" -> coach "Dankel", tenure "1-29 (3%)"
    const coachRaw = String(r[1] ?? "").replace(/\s+/g, " ").trim();
    const tenure = coachRaw.match(/^(.*?)\s*\((\d+-\d+)\)\s*([\d.]+%)$/);

    const row = {
      year: y,
      coach: (tenure ? tenure[1] : coachRaw).trim(),
      coachTenureRecord: tenure ? `${tenure[2]} (${tenure[3]})` : null,
      record: decodeRecordCell(r[2]) + rankSuffix(r[2]),
      winPct: pctCell(r[3]),
    };
    for (const [key, col] of Object.entries(TEAM_COUNT_COLS)) row[key] = countCell(r[col]);
    for (const [key, col] of Object.entries(TEAM_RATE_COLS)) row[key] = rateCell(r[col]);
    seasons.push(row);
  }

  seasons.sort((a, b) => a.year - b.year);
  return seasons;
}

// -------------------------------------------------------------- schedules

/**
 * Reads the "Schedules and Scores" tab, which lays seasons out two-per-row-band:
 * a year label, a header row, then the games, with the second season offset six
 * columns to the right.
 */
function buildSchedules(sheets) {
  const rows = tab(sheets, "Schedules and Scores").rows;
  const bySeason = new Map();

  for (let i = 0; i < rows.length; i++) {
    for (const col of [0, 7]) {
      const y = parseYear(rows[i]?.[col]);
      if (y === null) continue;
      if (String(rows[i + 1]?.[col] ?? "").trim().toLowerCase() !== "date") continue;

      const games = [];
      for (let j = i + 2; j < rows.length; j++) {
        const r = rows[j];
        // A band ends at the next year label or a fully blank row in this block.
        if (parseYear(r?.[col]) !== null) break;
        const event = String(r?.[col + 2] ?? "").trim();
        if (!event) break;

        const parsed = parseEvent(event);
        if (!parsed || !parsed.opponent) continue;

        const result = String(r[col + 3] ?? "").trim().toUpperCase();
        const score = parseScore(r[col + 4], result);
        if (!score) {
          fail(`${y}: could not read score ${JSON.stringify(r[col + 4])} vs ${parsed.opponent}`);
          continue;
        }
        if (!["W", "L", "T"].includes(result)) {
          note(`${y}: game vs ${parsed.opponent} has result ${JSON.stringify(result || "(blank)")} in the sheet`);
        }

        // Dates were dragged from a 2023 schedule for every season before 2023,
        // so only trust a serial whose own year matches the season.
        const serial = num(r[col]);
        let date = null;
        if (serial !== null) {
          const d = serialToDate(serial);
          if (d.year === y) {
            date = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
          }
        }

        games.push({
          date,
          opponent: parsed.opponent,
          homeAway: parsed.homeAway,
          neutral: parsed.neutral,
          result: ["W", "L", "T"].includes(result) ? result : "L",
          pointsFor: score.pointsFor,
          pointsAgainst: score.pointsAgainst,
        });
      }

      if (games.length) bySeason.set(y, games);
    }
  }

  return bySeason;
}

const oppKey = (s) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/**
 * True for two spellings of the same school. The prefix test exists for
 * co-ops, where one source keeps the short name and the other the merged one
 * ("University City" vs "University City/Maplewood-Richmond Heights").
 */
function sameOpponent(a, b) {
  const x = oppKey(a);
  const y = oppKey(b);
  return x === y || x.startsWith(y) || y.startsWith(x);
}

function gameFromSheet(g, index) {
  return {
    date: g.date,
    ...(g.date ? {} : { gameNo: index + 1 }),
    opponent: g.opponent,
    homeAway: g.homeAway,
    result: g.result,
    pointsFor: g.pointsFor,
    pointsAgainst: g.pointsAgainst,
  };
}

/**
 * Merges the spreadsheet's schedule into the existing history.json.
 *
 * The two sources overlap but neither is wholly right. history.json carries real
 * dates the spreadsheet lost (every pre-2023 date in the sheet is a 2023 date
 * that was dragged down a column) and reconciles exactly for most seasons, so it
 * is the default. The sheet supplies seasons the site never had at all
 * (1999-2003) and the occasional missing game.
 *
 * Where the two disagree on a score, the season's own team-stats row breaks the
 * tie: if adopting the sheet's numbers makes the season's points-for/against
 * total match that row and keeping history's does not, the sheet wins. That
 * catches the handful of real transcription errors (2008 Fox, 2023 Mehlville,
 * 2025 Pattonville) without silently overwriting anything arbitrarily. Conflicts
 * that neither source resolves are kept as history.json has them and reported.
 */
function mergeHistory(existing, bySeason, teamStatsByYear) {
  const merged = {};
  const years = [...new Set([...Object.keys(existing).map(Number), ...bySeason.keys()])].sort((a, b) => a - b);

  for (const y of years) {
    const sheetGames = bySeason.get(y) ?? [];
    const known = (existing[String(y)] ?? []).slice();

    if (!known.length) {
      merged[y] = sheetGames.map(gameFromSheet);
      continue;
    }

    // Walk the sheet in order, consuming the matching known game so a season
    // that plays one opponent twice (Oakville in 2023) stays distinct.
    const unused = known.slice();
    const out = [];
    const conflicts = [];

    for (let i = 0; i < sheetGames.length; i++) {
      const g = sheetGames[i];
      const idx = unused.findIndex((k) => sameOpponent(k.opponent, g.opponent));
      if (idx === -1) {
        note(`${y}: adding game missing from history.json — ${g.homeAway} vs ${g.opponent} ${g.result} ${g.pointsFor}-${g.pointsAgainst}`);
        out.push(gameFromSheet(g, i));
        continue;
      }

      const match = unused.splice(idx, 1)[0];
      out.push(match);
      if (match.pointsFor !== g.pointsFor || match.pointsAgainst !== g.pointsAgainst || match.result !== g.result) {
        conflicts.push({ game: match, sheet: g });
      }
    }

    // Anything the site has that the sheet does not is kept, never dropped.
    for (const leftover of unused) {
      note(`${y}: history.json has a game the spreadsheet does not — ${leftover.opponent} ${leftover.pointsFor}-${leftover.pointsAgainst} (kept)`);
      out.push(leftover);
    }

    if (conflicts.length) resolveConflicts(y, out, conflicts, teamStatsByYear.get(y));

    // Real dates order the season; undated seasons keep the sheet's order.
    if (out.every((g) => g.date)) out.sort((a, b) => a.date.localeCompare(b.date));
    merged[y] = out;
  }

  return merged;
}

/** Applies the sheet's numbers only when doing so reconciles the season. */
function resolveConflicts(y, games, conflicts, teamStats) {
  const sum = (key) => games.reduce((s, g) => s + g[key], 0);
  const statedPf = teamStats ? leadingNumber(teamStats.pf) : null;
  const statedPa = teamStats ? leadingNumber(teamStats.pa) : null;

  const describe = (c) =>
    `${c.game.opponent} — history ${c.game.result} ${c.game.pointsFor}-${c.game.pointsAgainst}, ` +
    `spreadsheet ${c.sheet.result} ${c.sheet.pointsFor}-${c.sheet.pointsAgainst}`;

  if (statedPf === null || statedPa === null) {
    for (const c of conflicts) note(`${y}: score conflict, kept history.json — ${describe(c)}`);
    return;
  }

  if (sum("pointsFor") === statedPf && sum("pointsAgainst") === statedPa) {
    for (const c of conflicts) note(`${y}: score conflict, kept history.json (it reconciles) — ${describe(c)}`);
    return;
  }

  const shiftPf = conflicts.reduce((s, c) => s + (c.sheet.pointsFor - c.game.pointsFor), 0);
  const shiftPa = conflicts.reduce((s, c) => s + (c.sheet.pointsAgainst - c.game.pointsAgainst), 0);

  if (sum("pointsFor") + shiftPf === statedPf && sum("pointsAgainst") + shiftPa === statedPa) {
    for (const c of conflicts) {
      note(`${y}: took the spreadsheet's score (it reconciles with the season totals) — ${describe(c)}`);
      c.game.result = c.sheet.result;
      c.game.pointsFor = c.sheet.pointsFor;
      c.game.pointsAgainst = c.sheet.pointsAgainst;
    }
    return;
  }

  for (const c of conflicts) {
    note(`${y}: score conflict neither source resolves, kept history.json — ${describe(c)}`);
  }
}

// ------------------------------------------------------------- validation

function recordOf(games) {
  let w = 0, l = 0, t = 0;
  for (const g of games) {
    if (g.result === "W") w++;
    else if (g.result === "L") l++;
    else t++;
  }
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

function leadingNumber(v) {
  const m = String(v ?? "").match(/^(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function validate(history, teamStats) {
  console.log("\nSeason reconciliation");
  console.log("  year  games  record   vs team-stats   points for / against");

  for (const t of teamStats) {
    const games = history[t.year] ?? [];
    const derived = recordOf(games);
    const stated = String(t.record).replace(/\s*\(\d+\)\s*$/, "");
    const pf = games.reduce((s, g) => s + g.pointsFor, 0);
    const pa = games.reduce((s, g) => s + g.pointsAgainst, 0);
    const statedPf = leadingNumber(t.pf);
    const statedPa = leadingNumber(t.pa);

    const marks = [];
    if (!games.length) marks.push("NO GAME LOG");
    else if (derived !== stated) marks.push(`RECORD ${derived} != ${stated}`);

    const dPf = statedPf === null ? 0 : pf - statedPf;
    const dPa = statedPa === null ? 0 : pa - statedPa;
    if (dPf || dPa) {
      const known = KNOWN_POINT_DISCREPANCIES[t.year];
      const expected = known && known[0] === dPf && known[1] === dPa;
      marks.push(`${expected ? "known" : "NEW"} points gap ${dPf >= 0 ? "+" : ""}${dPf}/${dPa >= 0 ? "+" : ""}${dPa}`);
      if (!expected) fail(`${t.year}: unexpected points discrepancy (game log ${pf}-${pa}, team stats ${statedPf}-${statedPa})`);
    }
    if (games.length && derived !== stated) {
      fail(`${t.year}: game log record ${derived} does not match team stats ${stated}`);
    }

    console.log(
      `  ${t.year}  ${String(games.length).padStart(5)}  ${derived.padEnd(7)}  ${stated.padEnd(13)}  ` +
        `${String(pf).padStart(4)} / ${String(pa).padStart(4)}  ${marks.join("; ")}`,
    );
  }
}

/** Flags names that look like an unmapped variant of one already in the data. */
function auditNames() {
  const canonical = new Set([...Object.values(NAME_ALIASES), ...Object.values(BARE_SURNAMES)]);
  const key = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  const lev = (a, b) => {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  };

  const names = [...seenNames].sort();
  const suspects = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = key(names[i]);
      const b = key(names[j]);
      if (a === b) {
        suspects.push([names[i], names[j]]);
        continue;
      }
      // One-character slips inside a surname are the failure mode worth catching;
      // two full names that differ by a short first name are usually siblings.
      if (Math.abs(a.length - b.length) <= 1 && a.length > 8 && lev(a, b) === 1) {
        const sameFirst = names[i].split(" ")[0] === names[j].split(" ")[0];
        if (sameFirst && !canonical.has(names[i]) === !canonical.has(names[j])) suspects.push([names[i], names[j]]);
      }
    }
  }

  const bare = names.filter((n) => !n.includes(" ") || AMBIGUOUS_NAMES.has(n));

  console.log(`\nNames: ${names.length} distinct after aliasing`);
  if (placeholderRows) {
    console.log(`  Dropped ${placeholderRows} row(s) whose name cell was a jersey number, not a name`);
  }
  if (suspects.length) {
    console.log("  Possible unmapped variants (add to NAME_ALIASES if they are the same player):");
    for (const [a, b] of suspects) console.log(`    ${JSON.stringify(a)}  ~  ${JSON.stringify(b)}`);
    for (const [a, b] of suspects) fail(`possible unmapped name variant: "${a}" ~ "${b}"`);
  }
  if (bare.length) {
    console.log(`  No first name in source (left as-is): ${bare.map((b) => JSON.stringify(b)).join(", ")}`);
  }
}

function auditYears(seasonRecords) {
  console.log("\nSingle-season rows missing a usable year (source column mixes jersey numbers):");
  for (const [category, rows] of Object.entries(seasonRecords)) {
    const missing = rows.filter((r) => r.year === null || r.year === undefined).length;
    if (missing) console.log(`  ${category.padEnd(12)} ${missing} of ${rows.length}`);
  }
}

// ------------------------------------------------------------------- output

function report(target) {
  const rel = path.relative(ROOT, target).replace(/\\/g, "/");
  console.log(`  ${rel}  (${(fs.statSync(target).size / 1024).toFixed(1)} KB)`);
}

function writeJson(file, value) {
  const target = path.join(DATA, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
  report(target);
}

const STATIC_URLS = [
  { loc: "https://rolljags.com/", changefreq: "weekly", priority: "1.0" },
  { loc: "https://rolljags.com/history", changefreq: "monthly", priority: "0.8" },
  { loc: "https://rolljags.com/records", changefreq: "monthly", priority: "0.8" },
  { loc: "https://rolljags.com/podcast", changefreq: "weekly", priority: "0.8" },
];

/** Regenerated here so a newly imported season can never be left out of it. */
function writeSitemap(history) {
  const urls = [
    ...STATIC_URLS,
    ...Object.keys(history)
      .map(Number)
      .sort((a, b) => b - a)
      .map((y) => ({
        loc: `https://rolljags.com/season?year=${y}`,
        changefreq: "yearly",
        priority: "0.5",
      })),
  ];

  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n` +
        `    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join("\n");

  const target = path.join(ROOT, "public", "sitemap.xml");
  fs.writeFileSync(
    target,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
  );
  report(target);
}

function main() {
  console.log(`Reading workbooks from ${SRC}`);

  const careerSheets = loadSheets("career");
  const seasonSheets = loadSheets("season");
  const gameSheets = loadSheets("game");
  const teamSheets = loadSheets("team");

  const career = buildCareer(careerSheets);
  const seasonRecords = buildSeasonRecords(seasonSheets);
  const gameRecords = buildGameRecords(gameSheets);
  const teamSeasonStats = buildTeamStats(teamSheets);

  canonicalizeNames([career, seasonRecords, gameRecords]);

  const teamStatsByYear = new Map(teamSeasonStats.map((t) => [t.year, t]));
  const existingHistory = JSON.parse(fs.readFileSync(path.join(DATA, "history.json"), "utf8"));
  const history = mergeHistory(existingHistory, buildSchedules(teamSheets), teamStatsByYear);

  // programTotals is computed from the seasons rather than copied: the sheet's
  // own summary row says 93-170 and 4448 points, both of which contradict the
  // season rows directly above it.
  const allGames = Object.values(history).flat();
  const totals = {
    record: recordOf(allGames),
    winPct: `${Math.round((allGames.filter((g) => g.result === "W").length / allGames.length) * 100)}%`,
    pf: allGames.reduce((s, g) => s + g.pointsFor, 0),
    pa: allGames.reduce((s, g) => s + g.pointsAgainst, 0),
  };
  totals.oppg = (totals.pf / allGames.length).toFixed(1);
  totals.dppg = (totals.pa / allGames.length).toFixed(1);

  const sumCol = (key) => teamSeasonStats.reduce((s, t) => s + (leadingNumber(t[key]) ?? 0), 0);
  const gameCount = allGames.length;
  totals.rushYds = sumCol("rushYds");
  totals.rushYpg = String(Math.round(totals.rushYds / gameCount));
  totals.passYds = sumCol("passYds");
  totals.passYpg = String(Math.round(totals.passYds / gameCount));
  totals.totalYds = totals.rushYds + totals.passYds;
  totals.totalYpg = String(Math.round(totals.totalYds / gameCount));

  const records = {
    careerScoring: career.scoring
      .map(({ name, tds, fgs, twoPt, onePt, safety, totalPoints }) => ({
        name,
        tds: tds ?? 0,
        fgs: fgs ?? 0,
        twoPt: twoPt ?? 0,
        onePt: onePt ?? 0,
        safety: safety ?? 0,
        totalPoints: totalPoints ?? 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints),
    seasonScoring: seasonRecords.scoring.map((r) => ({ player: r.player, year: r.year, tds: r.tds })),
    gameTouchdowns: gameRecords.touchdowns.map((r) => ({
      year: r.year,
      opponent: r.playoff ? `${r.opponent} (Playoffs)` : r.opponent,
      player: r.name,
      tds: r.tds,
    })),
    teamSeasonStats,
    programTotals: totals,
  };

  validate(history, teamSeasonStats);
  auditNames();
  auditYears(seasonRecords);

  console.log("\nProgram totals");
  console.log(`  ${totals.record} (${totals.winPct}), ${totals.pf} for / ${totals.pa} against over ${gameCount} games`);

  if (notes.length) {
    console.log("\nNotes");
    for (const n of notes) console.log(`  - ${n}`);
  }

  if (problems.length) {
    console.log("\nProblems");
    for (const p of problems) console.log(`  ! ${p}`);
  }

  if (CHECK_ONLY) {
    console.log("\n--check: nothing written.");
  } else if (problems.length) {
    console.log("\nRefusing to write while problems are outstanding. Re-run with --check after fixing.");
  } else {
    console.log("\nWriting");
    writeJson("history.json", history);
    writeJson("records.json", records);
    writeJson(path.join("records", "career.json"), career);
    writeJson(path.join("records", "season.json"), seasonRecords);
    writeJson(path.join("records", "game.json"), gameRecords);
    writeSitemap(history);
  }

  process.exit(problems.length ? 1 : 0);
}

main();
