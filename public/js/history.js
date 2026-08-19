import { computeRecord, recordString, formatStatCell, renderTable, renderRecordsSection, topByValue } from "./utils.js";

const seasonsEl = document.getElementById("seasons");
const leaderboardsEl = document.getElementById("leaderboards");
const headToHeadEl = document.getElementById("headToHead");

function seasonUrl(year) {
  return `/season?year=${encodeURIComponent(year)}`;
}

// Parses a "W-L" or "W-L-T" record string (as stored in records.json's
// teamSeasonStats, e.g. for years with no game-by-game log) into the same
// { wins, losses, ties } shape computeRecord() produces from real games.
function parseRecordString(str) {
  const [wins, losses, ties] = str.split("-").map((n) => parseInt(n, 10) || 0);
  return { wins, losses, ties: ties || 0 };
}

// Builds one season card. Years with a real game log link to the boxscore
// page; years with only an aggregate record (pre-2004, no game-by-game
// data available) render as a static, non-clickable card instead.
function buildSeasonCard(year, record, href = null) {
  const card = document.createElement(href ? "a" : "div");
  card.className = "week-card season-card";
  if (!href) card.classList.add("season-card-static");

  if (record.wins > record.losses) {
    card.classList.add("season-win");
  } else if (record.wins < record.losses) {
    card.classList.add("season-loss");
  } else {
    card.classList.add("season-even");
  }

  if (href) card.href = href;

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
  return card;
}

let seasonsGridEl = null;

// Renders the season cards backed by real game-by-game data (history.json).
// Returns the set of years rendered, so renderLegacySeasons() knows which
// years from records.json still need a (static) card of their own.
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
    const record = computeRecord(data[year]);
    grid.appendChild(buildSeasonCard(year, record, seasonUrl(year)));
  }

  section.appendChild(grid);
  seasonsEl.appendChild(section);

  seasonsGridEl = grid;
  return new Set(years);
}

// Appends static (non-linked) cards for seasons that only have an aggregate
// record in records.json's teamSeasonStats, no game-by-game log — e.g.
// 1999-2003. Since `years` from renderSeasons() is already sorted newest
// first and these are all older than every history.json year, appending
// them in descending order keeps the whole grid in order.
function renderLegacySeasons(teamSeasonStats, knownYears) {
  if (!seasonsGridEl || !teamSeasonStats) return;

  const extra = teamSeasonStats
    .filter((row) => !knownYears.has(String(row.year)))
    .sort((a, b) => b.year - a.year);

  for (const row of extra) {
    const record = parseRecordString(row.record);
    seasonsGridEl.appendChild(buildSeasonCard(row.year, record));
  }
}

function renderCareerScoring(list) {
  const table = renderTable(
    [
      { label: "Name", cell: (r) => r.name },
      { label: "TD", cell: (r) => r.tds },
      { label: "FG", cell: (r) => r.fgs },
      { label: "2Pt", cell: (r) => r.twoPt },
      { label: "1Pt", cell: (r) => r.onePt },
      { label: "Sft", cell: (r) => r.safety },
      { label: "Pts", cell: (r) => r.totalPoints },
    ],
    list
  );
  return renderRecordsSection("section-career-scoring", "Career Scoring Leaders", `${list.length} players`, table, { scroll: false });
}

function renderSeasonScoring(list) {
  const table = renderTable(
    [
      { label: "Player", cell: (r) => r.player },
      { label: "Year", cell: (r) => (r.year === null ? "—" : r.year) },
      { label: "TDs", cell: (r) => r.tds },
    ],
    list
  );
  return renderRecordsSection("section-season-scoring", "Single-Season TD Leaders", `${list.length} records`, table, { scroll: false });
}

function renderGameTouchdowns(list) {
  const table = renderTable(
    [
      { label: "Year", cell: (r) => r.year },
      { label: "Opponent", cell: (r) => r.opponent },
      { label: "Player", cell: (r) => r.player },
      { label: "TDs", cell: (r) => r.tds },
    ],
    list
  );
  return renderRecordsSection("section-game-touchdowns", "Single-Game TD Records", `${list.length} records`, table, { scroll: false });
}

const TEAM_SEASON_COLUMNS = [
  { key: "year", label: "Year", cell: (r) => r.year },
  { key: "coach", label: "Coach", cell: (r) => (r.coachTenureRecord ? `${r.coach} ${r.coachTenureRecord}` : r.coach) },
  { key: "record", label: "Record", cell: (r) => formatStatCell(r.record) },
  { key: "winPct", label: "Win%", cell: (r) => formatStatCell(r.winPct) },
  { key: "pf", label: "PF", cell: (r) => formatStatCell(r.pf) },
  { key: "pa", label: "PA", cell: (r) => formatStatCell(r.pa) },
  { key: "oppg", label: "Opp/G", cell: (r) => formatStatCell(r.oppg) },
  { key: "dppg", label: "Def/G", cell: (r) => formatStatCell(r.dppg) },
  { key: "rushYds", label: "Rush Yds", cell: (r) => formatStatCell(r.rushYds) },
  { key: "rushYpg", label: "Rush/G", cell: (r) => formatStatCell(r.rushYpg) },
  { key: "passYds", label: "Pass Yds", cell: (r) => formatStatCell(r.passYds) },
  { key: "passYpg", label: "Pass/G", cell: (r) => formatStatCell(r.passYpg) },
  { key: "totalYds", label: "Total Yds", cell: (r) => formatStatCell(r.totalYds) },
  { key: "totalYpg", label: "Total/G", cell: (r) => formatStatCell(r.totalYpg) },
  { key: "defInt", label: "INT", cell: (r) => formatStatCell(r.defInt) },
  { key: "defFumbles", label: "Fum Rec", cell: (r) => formatStatCell(r.defFumbles) },
  { key: "turnovers", label: "TO", cell: (r) => formatStatCell(r.turnovers) },
  { key: "sacks", label: "Sacks", cell: (r) => formatStatCell(r.sacks) },
];

const TEAM_SEASON_CATEGORY_KEYS = {
  "Passing Yards": ["year", "coach", "record", "winPct", "passYds", "passYpg", "totalYds", "totalYpg"],
  "Rushing Yards": ["year", "coach", "record", "winPct", "rushYds", "rushYpg", "totalYds", "totalYpg"],
  Sacks: ["year", "coach", "record", "winPct", "sacks", "defInt", "defFumbles", "turnovers"],
};

const TEAM_SEASON_NO_TOTAL_KEYS = ["defInt", "defFumbles", "turnovers", "sacks", "pf", "pa", "oppg", "dppg"];

function renderTeamSeasonStats(list, programTotals, category = null) {
  const keys = TEAM_SEASON_CATEGORY_KEYS[category];
  const columns = keys ? TEAM_SEASON_COLUMNS.filter((c) => keys.includes(c.key)) : TEAM_SEASON_COLUMNS;

  const footCells = programTotals
    ? (col) => {
        if (col.key === "year") return "Program Total";
        if (col.key === "coach") return "";
        if (TEAM_SEASON_NO_TOTAL_KEYS.includes(col.key)) return "";
        return formatStatCell(programTotals[col.key]);
      }
    : null;

  const table = renderTable(columns, list, { footCells });
  return renderRecordsSection("section-team-season", "Team Season Records", `${list.length} seasons`, table);
}

let recordsModalOverlay = null;
let recordsModalContent = null;
let cachedRecords = null;

function ensureRecordsModalBuilt() {
  if (recordsModalOverlay) return;

  recordsModalOverlay = document.createElement("div");
  recordsModalOverlay.className = "records-modal";
  recordsModalOverlay.setAttribute("role", "dialog");
  recordsModalOverlay.setAttribute("aria-modal", "true");

  recordsModalContent = document.createElement("div");
  recordsModalContent.className = "records-modal-content";

  const closeBtn = document.createElement("button");
  closeBtn.className = "records-modal-close";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Close");
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
  const card = document.createElement("button");
  card.type = "button";
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

  const link = document.createElement("span");
  link.className = "leaderboard-link";
  link.textContent = "View all";
  card.appendChild(link);

  card.addEventListener("click", () => {
    openRecordsModal(title, renderFn(cachedRecords));
  });

  return card;
}

function renderLeaderboards(records) {
  if (!leaderboardsEl) return;

  cachedRecords = records;
  leaderboardsEl.innerHTML = "";

  const heading = document.createElement("div");
  heading.className = "year-section leaders-heading";
  const headingText = document.createElement("h2");
  headingText.className = "section-heading";
  headingText.textContent = "Program Leaders";
  heading.appendChild(headingText);
  leaderboardsEl.appendChild(heading);

  const container = document.createElement("div");
  container.className = "leaderboards-container";

  const careerPoints = topByValue(records.careerScoring, (r) => ({ name: r.name, value: r.totalPoints }));

  const seasonTds = topByValue(records.seasonScoring, (r) => ({ name: r.player, value: r.tds, year: r.year })).map((r) => ({
    name: `${r.name} (${r.year || "—"})`,
    value: r.value,
  }));

  const gameTds = topByValue(records.gameTouchdowns, (r) => ({ name: r.player, value: r.tds, opp: r.opponent })).map((r) => ({
    name: `${r.name} vs ${r.opp}`,
    value: r.value,
  }));

  const passYards = topByValue(records.teamSeasonStats, (r) => ({ name: `${r.year}`, value: r.passYds }));
  const rushYards = topByValue(records.teamSeasonStats, (r) => ({ name: `${r.year}`, value: r.rushYds }));
  const sacks = topByValue(records.teamSeasonStats, (r) => ({ name: `${r.year}`, value: r.sacks }));

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

  const table = renderTable(
    [
      { label: "Opponent", cell: (r) => r.opponent },
      { label: "Record", cell: (r) => recordString(r) },
      { label: "PF", cell: (r) => r.pf },
      { label: "PA", cell: (r) => r.pa },
    ],
    rows
  );

  headToHeadEl.appendChild(renderRecordsSection("section-head-to-head", "All-Time Record by Opponent", `${rows.length} opponents`, table));
}

async function init() {
  let knownYears = new Set();

  try {
    const res = await fetch("/data/history.json");
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const data = await res.json();
    knownYears = renderSeasons(data);
    renderHeadToHead(data);
  } catch (err) {
    seasonsEl.innerHTML = '<p class="empty-state">Couldn\'t load history. Try refreshing.</p>';
  }

  try {
    const res = await fetch("/data/records.json");
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const records = await res.json();
    renderLeaderboards(records);
    renderLegacySeasons(records.teamSeasonStats, knownYears);
  } catch (err) {
    leaderboardsEl.innerHTML = '<p class="empty-state">Couldn\'t load leaders. Try refreshing.</p>';
  }
}

init();
