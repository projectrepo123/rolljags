// /player?n=12: one current player. The heading comes from the worker (see
// injectPlayerMeta in worker/lib/meta.js); this fills in the big jersey
// number, every record book category the player ranks in, and their career
// and season stat lines. Categories and ranking are the record book's own
// (records-config.js), so a rank here matches /records.

import { buildRecordTable, topBy, display } from "./records-ui.js";
import { GROUPS, SCOPE_LABELS, YEAR, OPPONENT, nameOf } from "./records-config.js";
import { loadRoster, earliestSeason } from "./roster-links.js";

const numberEl = document.getElementById("player-number");
const recordsEl = document.getElementById("player-records");
const statusEl = document.getElementById("player-status");

// Deep in a 700-row list isn't a record. Past this rank a category is left to
// the stat tables below.
const MAX_RANK = 25;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function loadScope(scope) {
  const res = await fetch(`/data/records/${scope}.json`);
  if (!res.ok) throw new Error(`${scope} records ${res.status}`);
  return res.json();
}

// Rows that are this player's. Season and game rows also have to fall inside
// this roster's years, so an alum with the same name isn't credited.
function playerRows(rows, category, scope, player, minYear) {
  return rows.filter((row) => {
    if (nameOf(row, category) !== player.name) return false;
    if (scope === "career") return true;
    return Number(row.year) >= minYear;
  });
}

function contextOf(row, scope) {
  if (scope === "season") return row.year ? String(row.year) : "";
  if (scope === "game") return [row.year, row.opponent && `vs ${row.opponent}${row.playoff ? " (Playoffs)" : ""}`].filter(Boolean).join(" · ");
  return "";
}

// Every category the player places in, best rank first.
function findEntries(data, player, minYear) {
  const entries = [];
  for (const scope of Object.keys(GROUPS)) {
    for (const group of GROUPS[scope]) {
      for (const category of group.categories) {
        const rows = data[scope][category.source] ?? [];
        const mine = playerRows(rows, category, scope, player, minYear);
        if (mine.length === 0) continue;
        const ranked = topBy(rows, category.rank, rows.length);
        for (const row of mine) {
          const rank = ranked.indexOf(row) + 1;
          if (rank < 1 || rank > MAX_RANK) continue;
          entries.push({ scope, category, row, rank });
        }
      }
    }
  }
  return entries.sort((a, b) => a.rank - b.rank);
}

function entryCard({ scope, category, row, rank }) {
  const link = el("a", `record-entry${rank <= 5 ? " top-five" : ""}`);
  link.href = scope === "career" ? "/records" : `/records?scope=${scope}`;
  const rankEl = el("span", "re-rank");
  rankEl.append(el("span", "re-hash", "#"), String(rank));
  link.append(
    rankEl,
    el("span", "re-title", category.title),
    el("span", "re-scope", scope === "career" ? SCOPE_LABELS.career : [SCOPE_LABELS[scope], contextOf(row, scope)].filter(Boolean).join(" · ")),
    el("span", "re-value", `${display(row[category.rank])} ${category.stat}`)
  );
  return link;
}

function section(title, ...children) {
  const s = el("section", "year-section player-section");
  s.appendChild(el("h2", "", title));
  s.append(...children);
  return s;
}

// One table per stat source (passing, rushing, defense...), using the first
// record book category for that source to pick the columns.
function statTables(data, player, minYear, scope) {
  const blocks = [];
  const seen = new Set();
  for (const group of GROUPS[scope]) {
    for (const category of group.categories) {
      if (seen.has(category.source)) continue;
      const rows = playerRows(data[scope][category.source] ?? [], category, scope, player, minYear);
      if (rows.length === 0) continue;
      seen.add(category.source);
      const lead = scope === "season" ? [YEAR] : scope === "game" ? [YEAR, OPPONENT] : [];
      const sorted = [...rows].sort((a, b) => Number(a.year || 0) - Number(b.year || 0));
      const block = el("div", "player-stat-block");
      block.appendChild(el("h3", "", category.source === "totalYards" ? "All-purpose" : category.source.replace(/([A-Z])/g, " $1")));
      block.appendChild(buildRecordTable([...lead, ...category.columns], sorted, { search: false }));
      blocks.push(block);
    }
  }
  return blocks;
}

async function init() {
  const n = new URLSearchParams(location.search).get("n");
  const roster = await loadRoster();
  const player = roster?.players.find((p) => String(p.number) === n);

  if (!player) {
    document.getElementById("player-title").textContent = "Player not found";
    statusEl.innerHTML = '<p class="empty-state">That number isn\'t on the current roster. <a href="/roster">See the full roster</a>.</p>';
    return;
  }

  numberEl.textContent = String(player.number);
  statusEl.innerHTML = '<p class="sr-only" role="status">Loading records</p>';

  try {
    const [career, season, game] = await Promise.all(["career", "season", "game"].map(loadScope));
    const data = { career, season, game };
    const minYear = earliestSeason(roster);
    statusEl.innerHTML = "";

    const entries = findEntries(data, player, minYear);
    if (entries.length > 0) {
      const grid = el("div", "record-entries");
      grid.append(...entries.map(entryCard));
      recordsEl.appendChild(section("Record Book", grid));
    }

    for (const [scope, title] of [["career", "Career Stats"], ["season", "By Season"]]) {
      const tables = statTables(data, player, minYear, scope);
      if (tables.length) recordsEl.appendChild(section(title, ...tables));
    }

    if (!recordsEl.children.length) {
      statusEl.replaceChildren(el("p", "empty-state", `No record book entries for ${player.name} yet. Stats go in after each season.`));
    }
  } catch (err) {
    statusEl.innerHTML = '<p class="empty-state">Couldn\'t load records. Try refreshing.</p>';
  }
}

init();
