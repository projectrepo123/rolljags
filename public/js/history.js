const seasonsEl = document.getElementById("seasons");

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

function seasonUrl(year) {
  return `/season?year=${encodeURIComponent(year)}`;
}

function renderSeasons(data) {
  seasonsEl.innerHTML = "";
  const years = Object.keys(data).sort((a, b) => b.localeCompare(a));

  const section = document.createElement("section");
  section.className = "year-section";

  const grid = document.createElement("div");
  grid.className = "week-grid";

  for (const year of years) {
    const games = data[year];
    const record = computeRecord(games);

    const card = document.createElement("a");
    card.className = "week-card season-card";
    card.href = seasonUrl(year);

    const body = document.createElement("div");
    body.className = "card-body season-card-body";

    const title = document.createElement("p");
    title.className = "card-title season-year";
    title.textContent = year;
    body.appendChild(title);

    const recordEl = document.createElement("p");
    recordEl.className = "season-record-display";
    recordEl.textContent = recordString(record);
    body.appendChild(recordEl);

    card.appendChild(body);
    grid.appendChild(card);
  }

  section.appendChild(grid);
  seasonsEl.appendChild(section);
}

async function init() {
  try {
    const res = await fetch("/data/history.json");
    const data = await res.json();
    renderSeasons(data);
  } catch (err) {
    seasonsEl.innerHTML = '<p class="empty-state">Couldn\'t load history. Try refreshing.</p>';
  }
}

init();
