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

function createCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function wrapTableWithSearch(tableEl) {
  const container = tableEl.parentNode;
  if (!container) return;

  const searchContainer = document.createElement("div");
  searchContainer.className = "table-search-container";
  searchContainer.style.marginBottom = "0.75rem";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "table-search-input";
  input.placeholder = "Search…";
  input.style.width = "100%";
  input.style.padding = "0.5rem 0.75rem";
  input.style.border = "1px solid var(--border)";
  input.style.borderRadius = "4px";
  input.style.fontSize = "0.95rem";

  const resultCount = document.createElement("span");
  resultCount.className = "search-result-count";
  resultCount.style.display = "block";
  resultCount.style.marginTop = "0.5rem";
  resultCount.style.fontSize = "0.85rem";
  resultCount.style.color = "var(--text-muted)";

  searchContainer.appendChild(input);
  searchContainer.appendChild(resultCount);
  container.insertBefore(searchContainer, tableEl);

  function updateSearch() {
    const query = input.value.toLowerCase();
    const tbody = tableEl.querySelector("tbody");
    let visibleCount = 0;

    if (tbody) {
      tbody.querySelectorAll("tr").forEach(row => {
        const text = row.textContent.toLowerCase();
        const isMatch = query === "" || text.includes(query);
        row.style.display = isMatch ? "" : "none";
        if (isMatch) visibleCount++;
      });
    }

    const total = tbody ? tbody.querySelectorAll("tr").length : 0;
    if (query) {
      resultCount.textContent = `${visibleCount} of ${total} results`;
    } else {
      resultCount.textContent = "";
    }
  }

  input.addEventListener("input", updateSearch);
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

function renderSeasonHighlights(games) {
  if (games.length === 0) return null;

  const stats = computeSeasonStats(games);

  const section = document.createElement("div");
  section.style.marginBottom = "2rem";

  const title = document.createElement("h4");
  title.textContent = "Season Highlights";
  title.style.marginBottom = "0.75rem";
  title.style.fontSize = "0.95rem";
  title.style.fontWeight = "600";
  title.style.color = "var(--navy)";
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
  renderStatTile(grid, "Total Points For", stats.gameCount > 0 ? `${stats.totalPointsFor} (${(stats.totalPointsFor / stats.gameCount).toFixed(1)}/game)` : null);
  renderStatTile(grid, "Total Points Against", stats.gameCount > 0 ? `${stats.totalPointsAgainst} (${(stats.totalPointsAgainst / stats.gameCount).toFixed(1)}/game)` : null);

  return grid.children.length > 0 ? section : null;
}

function renderSeasonLeaders(records, games) {
  if (!leadersEl || !year) return;

  const seasonTds = records.seasonScoring.filter(r => r.year == year);
  const gameTds = records.gameTouchdowns.filter(r => r.year == year);
  const highlights = renderSeasonHighlights(games || []);

  if (seasonTds.length === 0 && gameTds.length === 0 && !highlights) return;

  leadersEl.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = `${year} Season Leaders`;
  heading.style.marginTop = "2rem";
  heading.style.marginBottom = "1rem";
  heading.style.fontSize = "1.1rem";
  heading.style.fontWeight = "700";
  heading.style.borderBottom = "2px solid var(--gold)";
  heading.style.paddingBottom = "0.5rem";
  leadersEl.appendChild(heading);

  if (highlights) {
    leadersEl.appendChild(highlights);
  }

  if (seasonTds.length > 0) {
    const tdSection = document.createElement("div");
    tdSection.style.marginBottom = "2rem";

    const tdTitle = document.createElement("h4");
    tdTitle.textContent = "Top TD Scorers";
    tdTitle.style.marginBottom = "0.75rem";
    tdTitle.style.fontSize = "0.95rem";
    tdTitle.style.fontWeight = "600";
    tdTitle.style.color = "var(--navy)";
    tdSection.appendChild(tdTitle);

    const tdTable = document.createElement("table");
    tdTable.className = "season-table";

    const tdHead = document.createElement("thead");
    const tdHeadRow = document.createElement("tr");
    for (const col of ["Player", "TDs"]) {
      const th = document.createElement("th");
      th.textContent = col;
      tdHeadRow.appendChild(th);
    }
    tdHead.appendChild(tdHeadRow);
    tdTable.appendChild(tdHead);

    const tdBody = document.createElement("tbody");
    seasonTds.sort((a, b) => parseInt(b.tds) - parseInt(a.tds)).forEach(r => {
      const tr = document.createElement("tr");
      tr.appendChild(createCell(r.player));
      tr.appendChild(createCell(r.tds));
      tdBody.appendChild(tr);
    });
    tdTable.appendChild(tdBody);
    tdSection.appendChild(tdTable);
    wrapTableWithSearch(tdTable);
    leadersEl.appendChild(tdSection);
  }

  if (gameTds.length > 0) {
    const gameSection = document.createElement("div");
    gameSection.style.marginBottom = "2rem";

    const gameTitle = document.createElement("h4");
    gameTitle.textContent = "Single Game TD Records";
    gameTitle.style.marginBottom = "0.75rem";
    gameTitle.style.fontSize = "0.95rem";
    gameTitle.style.fontWeight = "600";
    gameTitle.style.color = "var(--navy)";
    gameSection.appendChild(gameTitle);

    const gameTable = document.createElement("table");
    gameTable.className = "season-table";

    const gameHead = document.createElement("thead");
    const gameHeadRow = document.createElement("tr");
    for (const col of ["Opponent", "Player", "TDs"]) {
      const th = document.createElement("th");
      th.textContent = col;
      gameHeadRow.appendChild(th);
    }
    gameHead.appendChild(gameHeadRow);
    gameTable.appendChild(gameHead);

    const gameBody = document.createElement("tbody");
    gameTds.sort((a, b) => parseInt(b.tds) - parseInt(a.tds)).forEach(r => {
      const tr = document.createElement("tr");
      tr.appendChild(createCell(r.opponent));
      tr.appendChild(createCell(r.player));
      tr.appendChild(createCell(r.tds));
      gameBody.appendChild(tr);
    });
    gameTable.appendChild(gameBody);
    gameSection.appendChild(gameTable);
    wrapTableWithSearch(gameTable);
    leadersEl.appendChild(gameSection);
  }
}

function renderSeason(games) {
  const record = computeRecord(games);

  titleEl.textContent = `${year} Season`;
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

async function init() {
  if (!year || !/^\d{4}$/.test(year)) {
    titleEl.textContent = "Season not found";
    return;
  }

  let games = null;

  try {
    const res = await fetch("/data/history.json");
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
    const res = await fetch("/data/records.json");
    const records = await res.json();
    renderSeasonLeaders(records, games);
  } catch (err) {
    console.error("Couldn't load season leaders:", err);
  }
}

init();
