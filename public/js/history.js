const seasonsEl = document.getElementById("seasons");
const leaderboardsEl = document.getElementById("leaderboards");
const recordsEl = document.getElementById("records");

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

function renderCareerScoring(list) {
  const details = document.createElement("details");
  details.id = "section-career-scoring";
  details.className = "records-section";

  const summary = document.createElement("summary");
  summary.innerHTML = `<strong>Career Scoring Leaders</strong> <span class="record-count">${list.length} players</span>`;
  details.appendChild(summary);

  const table = document.createElement("table");
  table.className = "records-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const col of ["Name", "TD", "FG", "2Pt", "1Pt", "Sft", "Pts"]) {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of list) {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(row.name));
    tr.appendChild(createCell(row.tds));
    tr.appendChild(createCell(row.fgs));
    tr.appendChild(createCell(row.twoPt));
    tr.appendChild(createCell(row.onePt));
    tr.appendChild(createCell(row.safety));
    tr.appendChild(createCell(row.totalPoints));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  details.appendChild(table);

  return details;
}

function renderSeasonScoring(list) {
  const details = document.createElement("details");
  details.id = "section-season-scoring";
  details.className = "records-section";

  const summary = document.createElement("summary");
  summary.innerHTML = `<strong>Single-Season TD Leaders</strong> <span class="record-count">${list.length} records</span>`;
  details.appendChild(summary);

  const table = document.createElement("table");
  table.className = "records-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const col of ["Player", "Year", "TDs"]) {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of list) {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(row.player));
    tr.appendChild(createCell(row.year === null ? "—" : row.year));
    tr.appendChild(createCell(row.tds));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  details.appendChild(table);

  return details;
}

function renderGameTouchdowns(list) {
  const details = document.createElement("details");
  details.id = "section-game-touchdowns";
  details.className = "records-section";

  const summary = document.createElement("summary");
  summary.innerHTML = `<strong>Single-Game TD Records</strong> <span class="record-count">${list.length} records</span>`;
  details.appendChild(summary);

  const table = document.createElement("table");
  table.className = "records-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const col of ["Year", "Opponent", "Player", "TDs"]) {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of list) {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(row.year));
    tr.appendChild(createCell(row.opponent));
    tr.appendChild(createCell(row.player));
    tr.appendChild(createCell(row.tds));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  details.appendChild(table);

  return details;
}

function renderTeamSeasonStats(list, programTotals) {
  const details = document.createElement("details");
  details.id = "section-team-season";
  details.className = "records-section";

  const summary = document.createElement("summary");
  summary.innerHTML = `<strong>Team Season Records</strong> <span class="record-count">${list.length} seasons</span>`;
  details.appendChild(summary);

  const scrollContainer = document.createElement("div");
  scrollContainer.className = "table-scroll";

  const table = document.createElement("table");
  table.className = "records-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const col of ["Year", "Coach", "Record", "Win%", "PF", "PA", "Opp/G", "Def/G", "Rush Yds", "Rush/G", "Pass Yds", "Pass/G", "Total Yds", "Total/G", "INT", "Fum Rec", "TO", "Sacks"]) {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of list) {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(row.year));
    tr.appendChild(createCell(row.coachTenureRecord ? `${row.coach} ${row.coachTenureRecord}` : row.coach));
    tr.appendChild(createCell(row.record));
    tr.appendChild(createCell(row.winPct));
    tr.appendChild(createCell(row.pf));
    tr.appendChild(createCell(row.pa));
    tr.appendChild(createCell(row.oppg));
    tr.appendChild(createCell(row.dppg));
    tr.appendChild(createCell(row.rushYds));
    tr.appendChild(createCell(row.rushYpg));
    tr.appendChild(createCell(row.passYds));
    tr.appendChild(createCell(row.passYpg));
    tr.appendChild(createCell(row.totalYds));
    tr.appendChild(createCell(row.totalYpg));
    tr.appendChild(createCell(row.defInt));
    tr.appendChild(createCell(row.defFumbles));
    tr.appendChild(createCell(row.turnovers));
    tr.appendChild(createCell(row.sacks));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  if (programTotals) {
    const tfoot = document.createElement("tfoot");
    const footRow = document.createElement("tr");
    footRow.appendChild(createCell("Program Total"));
    footRow.appendChild(createCell(""));
    footRow.appendChild(createCell(programTotals.record));
    footRow.appendChild(createCell(programTotals.winPct));
    footRow.appendChild(createCell(programTotals.pf));
    footRow.appendChild(createCell(programTotals.pa));
    footRow.appendChild(createCell(programTotals.oppg));
    footRow.appendChild(createCell(programTotals.dppg));
    footRow.appendChild(createCell(programTotals.rushYds));
    footRow.appendChild(createCell(programTotals.rushYpg));
    footRow.appendChild(createCell(programTotals.passYds));
    footRow.appendChild(createCell(programTotals.passYpg));
    footRow.appendChild(createCell(programTotals.totalYds));
    footRow.appendChild(createCell(programTotals.totalYpg));
    footRow.appendChild(createCell(""));
    footRow.appendChild(createCell(""));
    footRow.appendChild(createCell(""));
    footRow.appendChild(createCell(""));
    tfoot.appendChild(footRow);
    table.appendChild(tfoot);
  }

  scrollContainer.appendChild(table);
  details.appendChild(scrollContainer);

  return details;
}

function createCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function parseNumericValue(str) {
  if (!str) return 0;
  const match = str.toString().match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

function renderLeaderboardCard(title, items, sectionId) {
  const card = document.createElement("div");
  card.className = "leaderboard-card";
  card.onclick = () => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    const details = document.getElementById(sectionId);
    if (details && !details.open) details.open = true;
  };

  const titleEl = document.createElement("h3");
  titleEl.textContent = title;
  card.appendChild(titleEl);

  const listEl = document.createElement("ol");
  listEl.className = "leaderboard-list";
  for (let i = 0; i < Math.min(5, items.length); i++) {
    const item = items[i];
    const li = document.createElement("li");
    li.className = "leaderboard-item";
    li.innerHTML = `<span class="player">${item.name}</span> <span class="value">${item.value}</span>`;
    listEl.appendChild(li);
  }
  card.appendChild(listEl);

  const link = document.createElement("a");
  link.className = "leaderboard-link";
  link.href = "#";
  link.textContent = "View all";
  link.onclick = (e) => {
    e.preventDefault();
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };
  card.appendChild(link);

  return card;
}

function renderLeaderboards(records) {
  if (!leaderboardsEl) return;

  leaderboardsEl.innerHTML = "";

  const container = document.createElement("div");
  container.className = "leaderboards-container";

  const careerPoints = records.careerScoring
    .map(r => ({ name: r.name, value: r.totalPoints }))
    .sort((a, b) => parseNumericValue(b.value) - parseNumericValue(a.value))
    .slice(0, 10);

  const seasonTds = records.seasonScoring
    .map(r => ({ name: r.player, value: r.tds, year: r.year }))
    .sort((a, b) => parseNumericValue(b.value) - parseNumericValue(a.value))
    .slice(0, 10)
    .map(r => ({ name: `${r.name} (${r.year || "—"})`, value: r.value }));

  const gameTds = records.gameTouchdowns
    .map(r => ({ name: r.player, value: r.tds, year: r.year, opp: r.opponent }))
    .sort((a, b) => parseNumericValue(b.value) - parseNumericValue(a.value))
    .slice(0, 10)
    .map(r => ({ name: `${r.player} vs ${r.opp}`, value: r.value }));

  const passYards = records.teamSeasonStats
    .map(r => ({ name: `${r.year}`, value: r.passYds }))
    .sort((a, b) => parseNumericValue(b.value) - parseNumericValue(a.value))
    .slice(0, 10)
    .map(r => ({ name: r.name, value: r.value }));

  const rushYards = records.teamSeasonStats
    .map(r => ({ name: `${r.year}`, value: r.rushYds }))
    .sort((a, b) => parseNumericValue(b.value) - parseNumericValue(a.value))
    .slice(0, 10)
    .map(r => ({ name: r.name, value: r.value }));

  const sacks = records.teamSeasonStats
    .map(r => ({ name: `${r.year}`, value: r.sacks }))
    .sort((a, b) => parseNumericValue(b.value) - parseNumericValue(a.value))
    .slice(0, 10)
    .map(r => ({ name: r.name, value: r.value }));

  container.appendChild(renderLeaderboardCard("Career Points", careerPoints, "section-career-scoring"));
  container.appendChild(renderLeaderboardCard("Season TD Leaders", seasonTds, "section-season-scoring"));
  container.appendChild(renderLeaderboardCard("Single Game TD Records", gameTds, "section-game-touchdowns"));
  container.appendChild(renderLeaderboardCard("Passing Yards", passYards, "section-team-season"));
  container.appendChild(renderLeaderboardCard("Rushing Yards", rushYards, "section-team-season"));
  container.appendChild(renderLeaderboardCard("Sacks", sacks, "section-team-season"));

  leaderboardsEl.appendChild(container);
}

async function init() {
  try {
    const res = await fetch("/data/history.json");
    const data = await res.json();
    renderSeasons(data);
  } catch (err) {
    seasonsEl.innerHTML = '<p class="empty-state">Couldn\'t load history. Try refreshing.</p>';
  }

  if (!recordsEl) return;

  try {
    const res = await fetch("/data/records.json");
    const records = await res.json();

    renderLeaderboards(records);

    recordsEl.innerHTML = "";
    recordsEl.appendChild(renderCareerScoring(records.careerScoring));
    recordsEl.appendChild(renderSeasonScoring(records.seasonScoring));
    recordsEl.appendChild(renderGameTouchdowns(records.gameTouchdowns));
    recordsEl.appendChild(renderTeamSeasonStats(records.teamSeasonStats, records.programTotals));
  } catch (err) {
    recordsEl.innerHTML = '<p class="empty-state">Couldn\'t load records. Try refreshing.</p>';
  }
}

init();
