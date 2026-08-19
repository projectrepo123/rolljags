import { computeRecord, recordString, resultDisplay, renderTable } from "./utils.js";

const params = new URLSearchParams(location.search);
const year = params.get("year");

const titleEl = document.getElementById("season-title");
const recordEl = document.getElementById("season-record");
const tbodyEl = document.getElementById("season-tbody");
const statusEl = document.getElementById("season-status");
const leadersEl = document.getElementById("season-leaders");

function computeSeasonStats(games) {
  let biggestWin = null;
  let toughestLoss = null;
  const home = { wins: 0, losses: 0, ties: 0 };
  const away = { wins: 0, losses: 0, ties: 0 };
  let streakResult = null;
  let streakLen = 0;
  let bestWinStreak = 0;
  let bestLossStreak = 0;

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
  }

  return { biggestWin, toughestLoss, home, away, bestWinStreak, bestLossStreak };
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

function renderSeasonHighlights(games) {
  if (games.length === 0) return null;

  const stats = computeSeasonStats(games);

  const section = document.createElement("div");
  section.className = "subsection";

  const title = document.createElement("h4");
  title.className = "subsection-title";
  title.textContent = "Season Highlights";
  section.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "season-stats";
  section.appendChild(grid);

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

  return grid.children.length > 0 ? section : null;
}

function renderSeasonLeaders(records, games) {
  if (!leadersEl || !year) return;

  const seasonTds = records.seasonScoring.filter((r) => String(r.year) === year);
  const gameTds = records.gameTouchdowns.filter((r) => String(r.year) === year);
  const highlights = renderSeasonHighlights(games || []);

  if (seasonTds.length === 0 && gameTds.length === 0 && !highlights) return;

  leadersEl.innerHTML = "";

  const heading = document.createElement("h3");
  heading.className = "season-leaders-heading";
  heading.textContent = `${year} Season Leaders`;
  leadersEl.appendChild(heading);

  if (highlights) {
    leadersEl.appendChild(highlights);
  }

  if (seasonTds.length > 0) {
    const section = document.createElement("div");
    section.className = "subsection";

    const title = document.createElement("h4");
    title.className = "subsection-title";
    title.textContent = "Top TD Scorers";
    section.appendChild(title);

    section.appendChild(
      renderTable(
        [
          { label: "Player", cell: (r) => r.player },
          { label: "TDs", cell: (r) => r.tds },
        ],
        seasonTds.sort((a, b) => parseInt(b.tds) - parseInt(a.tds)),
        { className: "season-table" }
      )
    );

    leadersEl.appendChild(section);
  }

  if (gameTds.length > 0) {
    const section = document.createElement("div");
    section.className = "subsection";

    const title = document.createElement("h4");
    title.className = "subsection-title";
    title.textContent = "Single Game TD Records";
    section.appendChild(title);

    section.appendChild(
      renderTable(
        [
          { label: "Opponent", cell: (r) => r.opponent },
          { label: "Player", cell: (r) => r.player },
          { label: "TDs", cell: (r) => r.tds },
        ],
        gameTds.sort((a, b) => parseInt(b.tds) - parseInt(a.tds)),
        { className: "season-table" }
      )
    );

    leadersEl.appendChild(section);
  }
}

function renderSeason(games) {
  const record = computeRecord(games);

  setTitle(`${year} Season`);
  document.title = `${year} Season | Jaguar Football`;

  recordEl.innerHTML = `<strong>${recordString(record)}</strong>`;

  tbodyEl.innerHTML = "";
  for (const game of games) {
    const tr = document.createElement("tr");
    tr.className = game.result === "W" ? "game-win" : game.result === "L" ? "game-loss" : "game-tie";

    const dateCell = document.createElement("td");
    const date = new Date(`${game.date}T12:00:00`);
    dateCell.textContent = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

function setTitle(text) {
  titleEl.classList.remove("loading");
  titleEl.textContent = text;
}

async function init() {
  if (!year || !/^\d{4}$/.test(year)) {
    setTitle("Season not found");
    return;
  }

  let games = null;

  try {
    const res = await fetch("/data/history.json");
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const data = await res.json();

    if (!data[year]) {
      setTitle("Season not found");
      return;
    }

    games = data[year];
    renderSeason(games);
  } catch (err) {
    setTitle("Couldn't load this season");
  }

  try {
    const res = await fetch("/data/records.json");
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const records = await res.json();
    renderSeasonLeaders(records, games);
  } catch (err) {
    if (leadersEl) leadersEl.innerHTML = '<p class="empty-state">Couldn\'t load season leaders. Try refreshing.</p>';
  }
}

init();
