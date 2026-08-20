import { createCell, wrapTableWithSearch, display, topBy } from "./records-ui.js";

const params = new URLSearchParams(location.search);
const year = params.get("year");

const titleEl = document.getElementById("season-title");
const recordEl = document.getElementById("season-record");
const tbodyEl = document.getElementById("season-tbody");
const statusEl = document.getElementById("season-status");
const leadersEl = document.getElementById("season-leaders");

function computeRecord(games) {
  let wins = 0, losses = 0, ties = 0;
  for (const game of games) {
    if (game.result === "W") wins++;
    else if (game.result === "L") losses++;
    else if (game.result === "T") ties++;
  }
  return { wins, losses, ties };
}

function recordString(record) {
  let str = `${record.wins}-${record.losses}`;
  if (record.ties > 0) str += `-${record.ties}`;
  return str;
}

function resultDisplay(game) {
  const symbol = game.result === "W" ? "W" : game.result === "L" ? "L" : "T";
  return `${symbol} ${game.pointsFor}-${game.pointsAgainst}`;
}

// Seasons before 2004 have no recoverable dates — the spreadsheet's date cells
// for those years hold a 2023 schedule that was dragged down the column — so
// they are numbered instead. See scripts/import-stats.mjs.
function gameDateLabel(game) {
  if (!game.date) return game.gameNo ? `Game ${game.gameNo}` : "—";
  const date = new Date(`${game.date}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function computeSeasonStats(games) {
  let biggestWin = null;
  let toughestLoss = null;
  const home = { wins: 0, losses: 0, ties: 0 };
  const away = { wins: 0, losses: 0, ties: 0 };
  let streakResult = null;
  let streakLen = 0;
  let bestWinStreak = 0;
  let bestLossStreak = 0;
  let totalPointsFor = 0;
  let totalPointsAgainst = 0;

  for (const game of games) {
    const margin = game.pointsFor - game.pointsAgainst;

    if (game.result === "W" && (!biggestWin || margin > biggestWin.pointsFor - biggestWin.pointsAgainst)) {
      biggestWin = game;
    }
    if (game.result === "L" && (!toughestLoss || -margin > toughestLoss.pointsAgainst - toughestLoss.pointsFor)) {
      toughestLoss = game;
    }

    const loc = game.homeAway === "Home" ? home : away;
    if (game.result === "W") loc.wins++;
    else if (game.result === "L") loc.losses++;
    else loc.ties++;

    if (game.result === streakResult) {
      streakLen++;
    } else {
      streakResult = game.result;
      streakLen = 1;
    }
    if (streakResult === "W") bestWinStreak = Math.max(bestWinStreak, streakLen);
    if (streakResult === "L") bestLossStreak = Math.max(bestLossStreak, streakLen);

    totalPointsFor += game.pointsFor;
    totalPointsAgainst += game.pointsAgainst;
  }

  return { biggestWin, toughestLoss, home, away, bestWinStreak, bestLossStreak, totalPointsFor, totalPointsAgainst, gameCount: games.length };
}

function renderStatTile(container, label, value) {
  if (!value) return;
  const tile = document.createElement("div");
  tile.className = "stat-tile";
  const labelEl = document.createElement("p");
  labelEl.className = "stat-tile-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("p");
  valueEl.className = "stat-tile-value";
  valueEl.textContent = value;
  tile.appendChild(labelEl);
  tile.appendChild(valueEl);
  container.appendChild(tile);
}

/** A titled block within the season-leaders section. */
function subsection(title, content) {
  const section = document.createElement("div");
  section.className = "season-subsection";

  const heading = document.createElement("h4");
  heading.className = "subsection-title";
  heading.textContent = title;
  section.appendChild(heading);
  section.appendChild(content);

  return section;
}

function renderSeasonHighlights(games) {
  if (games.length === 0) return null;

  const stats = computeSeasonStats(games);

  const grid = document.createElement("div");
  grid.className = "season-stats";
  const section = subsection("Season Highlights", grid);

  renderStatTile(grid, "Biggest Win", stats.biggestWin
    ? `${resultDisplay(stats.biggestWin)} vs. ${stats.biggestWin.opponent}`
    : null);
  renderStatTile(grid, "Toughest Loss", stats.toughestLoss
    ? `${resultDisplay(stats.toughestLoss)} vs. ${stats.toughestLoss.opponent}`
    : null);
  renderStatTile(grid, "Longest Win Streak", stats.bestWinStreak > 1 ? `${stats.bestWinStreak} games` : null);
  renderStatTile(grid, "Longest Losing Streak", stats.bestLossStreak > 1 ? `${stats.bestLossStreak} games` : null);
  renderStatTile(grid, "Home Record", stats.home.wins + stats.home.losses + stats.home.ties > 0
    ? recordString({ wins: stats.home.wins, losses: stats.home.losses, ties: stats.home.ties })
    : null);
  renderStatTile(grid, "Away Record", stats.away.wins + stats.away.losses + stats.away.ties > 0
    ? recordString({ wins: stats.away.wins, losses: stats.away.losses, ties: stats.away.ties })
    : null);
  renderStatTile(grid, "Total Points For", stats.gameCount > 0 ? `${stats.totalPointsFor} (${(stats.totalPointsFor / stats.gameCount).toFixed(1)}/game)` : null);
  renderStatTile(grid, "Total Points Against", stats.gameCount > 0 ? `${stats.totalPointsAgainst} (${(stats.totalPointsAgainst / stats.gameCount).toFixed(1)}/game)` : null);

  return grid.children.length > 0 ? section : null;
}

/** Builds a plain table (no scroll wrapper) in the season page's own style. */
function statTable(columns, rows) {
  const table = document.createElement("table");
  table.className = "season-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = col.label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const col of columns) {
      tr.appendChild(createCell(display(col.format ? col.format(row) : row[col.key])));
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const scroll = document.createElement("div");
  scroll.className = "table-scroll";
  scroll.appendChild(table);

  const block = document.createElement("div");
  block.appendChild(scroll);
  return rows.length > 12 ? wrapTableWithSearch(block, table) : block;
}

const col = (label, key, format) => ({ label, key, ...(format ? { format } : {}) });

// Per-season individual categories, in the order they appear under the game
// table. Each is only rendered when this season actually has rows for it —
// the source's single-season defensive and special-teams tabs carry a usable
// year for only some rows, so older seasons legitimately have nothing here.
const SEASON_CATEGORIES = [
  { title: "Passing", source: "passing", rank: "yards",
    columns: [col("Player", "name"), col("Comp", "completions"), col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("INT", "ints")] },
  { title: "Rushing", source: "rushing", rank: "yards",
    columns: [col("Player", "name"), col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
  { title: "Receiving", source: "receiving", rank: "yards",
    columns: [col("Player", "name"), col("Rec", "receptions"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
  { title: "Defensive Leaders", source: "defense", rank: "total",
    columns: [col("Player", "name"), col("Tackles", "tackles"), col("Assists", "assists"), col("Total", "total"), col("Sacks", "sacks"), col("Fum Rec", "fumbleRec"), col("INT", "ints")] },
  { title: "Kicking", source: "kicking", rank: "yards",
    columns: [col("Player", "name"), col("Att", "attempts"), col("Yards", "yards"), col("Avg", "avg"), col("XP", "xp")] },
  { title: "Punting", source: "punting", rank: "yards",
    columns: [col("Player", "name"), col("Att", "attempts"), col("Yards", "yards"), col("Avg", "avg")] },
  { title: "Kick Returns", source: "kickReturn", rank: "yards",
    columns: [col("Player", "name"), col("Ret", "attempts"), col("Yards", "yards"), col("Avg", "avg")] },
  { title: "Punt Returns", source: "puntReturn", rank: "yards",
    columns: [col("Player", "name"), col("Ret", "attempts"), col("Yards", "yards"), col("Avg", "avg")] },
];

function renderSeasonLeaders(records, seasonRecords, games) {
  if (!leadersEl || !year) return;

  // records.json stores year as a number and the query string gives a string.
  const forThisYear = (rows) => (rows ?? []).filter((r) => String(r.year) === year);

  const seasonTds = forThisYear(records.seasonScoring).sort((a, b) => b.tds - a.tds);
  const gameTds = forThisYear(records.gameTouchdowns).sort((a, b) => b.tds - a.tds);

  const blocks = [];

  const highlights = renderSeasonHighlights(games || []);
  if (highlights) blocks.push(highlights);

  if (seasonTds.length) {
    blocks.push(subsection("Top TD Scorers", statTable([col("Player", "player"), col("TDs", "tds")], seasonTds)));
  }

  for (const category of SEASON_CATEGORIES) {
    const rows = forThisYear(seasonRecords?.[category.source]);
    if (!rows.length) continue;
    blocks.push(subsection(category.title, statTable(category.columns, topBy(rows, category.rank, rows.length))));
  }

  if (gameTds.length) {
    blocks.push(
      subsection(
        "Single Game TD Records",
        statTable([col("Opponent", "opponent"), col("Player", "player"), col("TDs", "tds")], gameTds),
      ),
    );
  }

  if (!blocks.length) return;

  leadersEl.innerHTML = "";

  const heading = document.createElement("h3");
  heading.className = "season-leaders-heading";
  heading.textContent = `${year} Season Leaders`;
  leadersEl.appendChild(heading);

  for (const block of blocks) leadersEl.appendChild(block);
}

function renderSeason(games) {
  const record = computeRecord(games);

  titleEl.textContent = `${year} Season`;
  document.title = `${year} Season | Jaguar Football`;

  // This page is one HTML file serving every season, so point the canonical
  // at the specific year rather than letting them all collapse together.
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = `https://rolljags.com/season?year=${encodeURIComponent(year)}`;

  recordEl.innerHTML = `<strong>${recordString(record)}</strong>`;

  tbodyEl.innerHTML = "";
  for (const game of games) {
    const tr = document.createElement("tr");
    tr.className = game.result === "W" ? "game-win" : game.result === "L" ? "game-loss" : "game-tie";

    const dateCell = document.createElement("td");
    dateCell.textContent = gameDateLabel(game);
    tr.appendChild(dateCell);

    const opponentCell = document.createElement("td");
    opponentCell.textContent = game.opponent;
    tr.appendChild(opponentCell);

    const locationCell = document.createElement("td");
    locationCell.textContent = game.homeAway === "Home" ? "H" : "A";
    tr.appendChild(locationCell);

    const resultCell = document.createElement("td");
    resultCell.textContent = resultDisplay(game);
    resultCell.className = "result-cell";
    tr.appendChild(resultCell);

    const typeCell = document.createElement("td");
    typeCell.textContent = game.gameType || "";
    tr.appendChild(typeCell);

    tbodyEl.appendChild(tr);
  }
}

async function init() {
  if (!year || !/^\d{4}$/.test(year)) {
    titleEl.textContent = "Season not found";
    return;
  }

  let games = null;

  try {
    const res = await fetch("/data/history.json");
    if (!res.ok) throw new Error(`history.json ${res.status}`);
    const data = await res.json();

    if (!data[year]) {
      titleEl.textContent = "Season not found";
      return;
    }

    games = data[year];
    renderSeason(games);
  } catch (err) {
    titleEl.textContent = "Couldn't load this season";
  }

  try {
    // The per-season individual records live in their own file so /history and
    // the homepage don't pay to download them.
    const [recordsRes, seasonRes] = await Promise.all([
      fetch("/data/records.json"),
      fetch("/data/records/season.json"),
    ]);
    if (!recordsRes.ok) throw new Error(`records.json ${recordsRes.status}`);

    const records = await recordsRes.json();
    const seasonRecords = seasonRes.ok ? await seasonRes.json() : null;
    renderSeasonLeaders(records, seasonRecords, games);
  } catch (err) {
    if (statusEl) {
      statusEl.innerHTML = '<p class="empty-state">Couldn\'t load this season\'s individual stats.</p>';
    }
  }
}

init();
