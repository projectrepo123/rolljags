const params = new URLSearchParams(location.search);
const year = params.get("year");

const titleEl = document.getElementById("season-title");
const recordEl = document.getElementById("season-record");
const tbodyEl = document.getElementById("season-tbody");
const statusEl = document.getElementById("season-status");

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
    typeCell.textContent = game.gameType;
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
}

init();
