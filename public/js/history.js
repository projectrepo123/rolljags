const seasonsEl = document.getElementById("seasons");
const leaderboardsEl = document.getElementById("leaderboards");
const headToHeadEl = document.getElementById("headToHead");

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

  const headingWrapper = document.createElement("div");
  headingWrapper.className = "year-section";
  const heading = document.createElement("h2");
  heading.className = "section-heading";
  heading.textContent = "Seasons";
  headingWrapper.appendChild(heading);
  seasonsEl.appendChild(headingWrapper);

  const section = document.createElement("section");
  section.className = "year-section";

  const grid = document.createElement("div");
  grid.className = "week-grid";

  for (const year of years) {
    const games = data[year];
    const record = computeRecord(games);

    const card = document.createElement("a");
    card.className = "week-card season-card";

    if (record.wins > record.losses) {
      card.classList.add("season-win");
    } else if (record.wins < record.losses) {
      card.classList.add("season-loss");
    } else {
      card.classList.add("season-even");
    }

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

function renderTeamSeasonStats(list, programTotals, category = null) {
  const details = document.createElement("details");
  details.id = "section-team-season";
  details.className = "records-section";

  const summary = document.createElement("summary");
  summary.innerHTML = `<strong>Team Season Records</strong> <span class="record-count">${list.length} seasons</span>`;
  details.appendChild(summary);

  const allColumns = [
    { key: "year", label: "Year" },
    { key: "coach", label: "Coach" },
    { key: "record", label: "Record" },
    { key: "winPct", label: "Win%" },
    { key: "pf", label: "PF" },
    { key: "pa", label: "PA" },
    { key: "oppg", label: "Opp/G" },
    { key: "dppg", label: "Def/G" },
    { key: "rushYds", label: "Rush Yds" },
    { key: "rushYpg", label: "Rush/G" },
    { key: "passYds", label: "Pass Yds" },
    { key: "passYpg", label: "Pass/G" },
    { key: "totalYds", label: "Total Yds" },
    { key: "totalYpg", label: "Total/G" },
    { key: "defInt", label: "INT" },
    { key: "defFumbles", label: "Fum Rec" },
    { key: "turnovers", label: "TO" },
    { key: "sacks", label: "Sacks" },
  ];

  let columns = allColumns;
  if (category === "Passing Yards") {
    columns = allColumns.filter(c => ["year", "coach", "record", "winPct", "passYds", "passYpg", "totalYds", "totalYpg"].includes(c.key));
  } else if (category === "Rushing Yards") {
    columns = allColumns.filter(c => ["year", "coach", "record", "winPct", "rushYds", "rushYpg", "totalYds", "totalYpg"].includes(c.key));
  } else if (category === "Sacks") {
    columns = allColumns.filter(c => ["year", "coach", "record", "winPct", "sacks", "defInt", "defFumbles", "turnovers"].includes(c.key));
  }

  const scrollContainer = document.createElement("div");
  scrollContainer.className = "table-scroll";

  const table = document.createElement("table");
  table.className = "records-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    th.textContent = col.label;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of list) {
    const tr = document.createElement("tr");
    for (const col of columns) {
      if (col.key === "coach") {
        tr.appendChild(createCell(row.coachTenureRecord ? `${row.coach} ${row.coachTenureRecord}` : row.coach));
      } else if (col.key === "year") {
        tr.appendChild(createCell(row.year));
      } else {
        tr.appendChild(formatStatCell(row[col.key]));
      }
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  if (programTotals) {
    const tfoot = document.createElement("tfoot");
    const footRow = document.createElement("tr");
    for (const col of columns) {
      if (col.key === "year") {
        footRow.appendChild(createCell("Program Total"));
      } else if (col.key === "coach") {
        footRow.appendChild(createCell(""));
      } else if (["defInt", "defFumbles", "turnovers", "sacks", "pf", "pa", "oppg", "dppg"].includes(col.key)) {
        footRow.appendChild(createCell(""));
      } else {
        footRow.appendChild(formatStatCell(programTotals[col.key]));
      }
    }
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

function formatStatCell(raw) {
  const td = document.createElement("td");
  if (raw === null || raw === undefined || raw === "") return td;
  const str = String(raw);
  const match = str.match(/^(.+?)\s*\((\d+)\)$/);
  if (!match) {
    td.textContent = str;
    return td;
  }
  td.appendChild(document.createTextNode(match[1]));
  const rank = document.createElement("sup");
  rank.className = "stat-rank";
  rank.textContent = match[2];
  td.appendChild(rank);
  return td;
}

function parseNumericValue(str) {
  if (!str) return 0;
  const match = str.toString().match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

let recordsModalOverlay = null;
let recordsModalContent = null;
let cachedRecords = null;

function ensureRecordsModalBuilt() {
  if (recordsModalOverlay) return;

  recordsModalOverlay = document.createElement("div");
  recordsModalOverlay.className = "records-modal";

  recordsModalContent = document.createElement("div");
  recordsModalContent.className = "records-modal-content";

  const closeBtn = document.createElement("button");
  closeBtn.className = "records-modal-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = closeRecordsModal;
  recordsModalContent.appendChild(closeBtn);

  const contentArea = document.createElement("div");
  contentArea.className = "records-modal-inner";
  recordsModalContent.appendChild(contentArea);

  recordsModalOverlay.appendChild(recordsModalContent);
  recordsModalOverlay.onclick = (e) => {
    if (e.target === recordsModalOverlay) closeRecordsModal();
  };

  document.body.appendChild(recordsModalOverlay);

  document.addEventListener("keydown", (e) => {
    if (!recordsModalOverlay.classList.contains("open")) return;
    if (e.key === "Escape") closeRecordsModal();
  });
}

function openRecordsModal(title, contentElement) {
  ensureRecordsModalBuilt();
  const inner = recordsModalContent.querySelector(".records-modal-inner");
  inner.innerHTML = "";

  const heading = document.createElement("h2");
  heading.textContent = title;
  heading.className = "records-modal-title";
  inner.appendChild(heading);

  inner.appendChild(contentElement);
  recordsModalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeRecordsModal() {
  if (recordsModalOverlay) {
    recordsModalOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }
}

function renderLeaderboardCard(title, items, renderFn) {
  const card = document.createElement("div");
  card.className = "leaderboard-card";

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
    openRecordsModal(title, renderFn(cachedRecords));
  };
  card.appendChild(link);

  return card;
}

function renderLeaderboards(records) {
  if (!leaderboardsEl) return;

  cachedRecords = records;
  leaderboardsEl.innerHTML = "";

  const heading = document.createElement("h3");
  heading.className = "year-section";
  heading.style.fontSize = "1rem";
  heading.style.marginBottom = "1.5rem";
  const headingText = document.createElement("h2");
  headingText.className = "section-heading";
  headingText.textContent = "Program Leaders";
  heading.appendChild(headingText);
  leaderboardsEl.appendChild(heading);

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
    .map(r => ({ name: `${r.name} vs ${r.opp}`, value: r.value }));

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

  container.appendChild(renderLeaderboardCard("Career Points", careerPoints, () => renderCareerScoring(records.careerScoring)));
  container.appendChild(renderLeaderboardCard("Season TD Leaders", seasonTds, () => renderSeasonScoring(records.seasonScoring)));
  container.appendChild(renderLeaderboardCard("Single Game TD Records", gameTds, () => renderGameTouchdowns(records.gameTouchdowns)));
  container.appendChild(renderLeaderboardCard("Passing Yards", passYards, () => renderTeamSeasonStats(records.teamSeasonStats, records.programTotals, "Passing Yards")));
  container.appendChild(renderLeaderboardCard("Rushing Yards", rushYards, () => renderTeamSeasonStats(records.teamSeasonStats, records.programTotals, "Rushing Yards")));
  container.appendChild(renderLeaderboardCard("Sacks", sacks, () => renderTeamSeasonStats(records.teamSeasonStats, records.programTotals, "Sacks")));

  leaderboardsEl.appendChild(container);
}

function computeHeadToHead(data) {
  const byOpponent = {};

  for (const games of Object.values(data)) {
    for (const game of games) {
      if (!byOpponent[game.opponent]) {
        byOpponent[game.opponent] = { opponent: game.opponent, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 };
      }
      const row = byOpponent[game.opponent];
      if (game.result === "W") row.wins++;
      else if (game.result === "L") row.losses++;
      else row.ties++;
      row.pf += game.pointsFor;
      row.pa += game.pointsAgainst;
    }
  }

  return Object.values(byOpponent).sort((a, b) => {
    const gamesA = a.wins + a.losses + a.ties;
    const gamesB = b.wins + b.losses + b.ties;
    if (gamesB !== gamesA) return gamesB - gamesA;
    return a.opponent.localeCompare(b.opponent);
  });
}

function renderHeadToHead(data) {
  if (!headToHeadEl) return;

  const rows = computeHeadToHead(data);
  if (rows.length === 0) return;

  headToHeadEl.innerHTML = "";

  const heading = document.createElement("h2");
  heading.className = "section-heading";
  heading.textContent = "Head-to-Head Records";
  headToHeadEl.appendChild(heading);

  const details = document.createElement("details");
  details.id = "section-head-to-head";
  details.className = "records-section";

  const summary = document.createElement("summary");
  summary.innerHTML = `<strong>All-Time Record by Opponent</strong> <span class="record-count">${rows.length} opponents</span>`;
  details.appendChild(summary);

  const scrollContainer = document.createElement("div");
  scrollContainer.className = "table-scroll";

  const table = document.createElement("table");
  table.className = "records-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const col of ["Opponent", "Record", "PF", "PA"]) {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(row.opponent));
    tr.appendChild(createCell(recordString(row)));
    tr.appendChild(createCell(row.pf));
    tr.appendChild(createCell(row.pa));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  scrollContainer.appendChild(table);
  details.appendChild(scrollContainer);
  headToHeadEl.appendChild(details);
}

async function init() {
  try {
    const res = await fetch("/data/history.json");
    const data = await res.json();
    renderSeasons(data);
    renderHeadToHead(data);
  } catch (err) {
    seasonsEl.innerHTML = '<p class="empty-state">Couldn\'t load history. Try refreshing.</p>';
  }

  try {
    const res = await fetch("/data/records.json");
    const records = await res.json();
    renderLeaderboards(records);
  } catch (err) {
    leaderboardsEl.innerHTML = '<p class="empty-state">Couldn\'t load leaders. Try refreshing.</p>';
  }
}

init();
