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

function renderSeasonLeaders(records) {
  if (!leadersEl || !year) return;

  const seasonTds = records.seasonScoring.filter(r => r.year == year);
  const gameTds = records.gameTouchdowns.filter(r => r.year == year);

  if (seasonTds.length === 0 && gameTds.length === 0) return;

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

  try {
    const res = await fetch("/data/history.json");
    const data = await res.json();

    if (!data[year]) {
      titleEl.textContent = "Season not found";
      return;
    }

    renderSeason(data[year]);
  } catch (err) {
    titleEl.textContent = "Couldn't load this season";
  }

  try {
    const res = await fetch("/data/records.json");
    const records = await res.json();
    renderSeasonLeaders(records);
  } catch (err) {
    console.error("Couldn't load season leaders:", err);
  }
}

init();
