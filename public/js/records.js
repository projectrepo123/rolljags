// /records: the full record book.
//
// Three scopes (career / single season / single game), each grouped into
// offense, defense and special teams. Every category is a top-five card whose
// "View all" opens the complete searchable table, so a 700-row defensive list
// stays browsable. Scope data is fetched on first use and kept in memory.

import {
  renderLeaderboardCard,
  buildRecordTable,
  topBy,
  display,
} from "./records-ui.js";

const panel = document.getElementById("scope-panel");
const tabs = document.getElementById("scope-tabs");

// ------------------------------------------------------------ column shorthand

const PLAYER = { label: "Player", key: "name" };
const YEAR = { label: "Year", key: "year", format: (r) => display(r.year) };
const OPPONENT = {
  label: "Opponent",
  key: "opponent",
  format: (r) => (r.playoff ? `${r.opponent} (Playoffs)` : r.opponent),
};

const col = (label, key, format) => ({ label, key, ...(format ? { format } : {}) });

// Stat columns shared by kicking / punting / both return categories.
const KICK_COLS = [col("Att", "attempts"), col("Yards", "yards"), col("Avg", "avg")];

const DEFENSE_COLS = [
  col("Tackles", "tackles"),
  col("Assists", "assists"),
  col("Total", "total"),
  col("Sacks", "sacks"),
  col("Fum Rec", "fumbleRec"),
  col("INT", "ints"),
  col("TD", "tds"),
];

/**
 * Every category the record book renders.
 *
 * `source` is the key in the scope's JSON, `rank` the field it sorts on, and
 * `stat` the column heading for that value on the card. Several categories share
 * one source and differ only by `rank`, which is how one defensive table
 * produces separate tackle, sack, interception and fumble leaderboards.
 */
const GROUPS = {
  career: [
    {
      name: "Offense",
      categories: [
        { title: "Career Points", source: "scoring", rank: "totalPoints", stat: "Points",
          columns: [col("TD", "tds"), col("FG", "fgs"), col("2PT", "twoPt"), col("XP", "onePt"), col("Safety", "safety"), col("Points", "totalPoints")] },
        { title: "Passing Yards", source: "passing", rank: "yards", stat: "Yards",
          columns: [col("Comp", "completions"), col("Att", "attempts"), col("Pct", "pct"), col("Yards", "yards"), col("TD", "tds"), col("INT", "ints")] },
        { title: "Rushing Yards", source: "rushing", rank: "yards", stat: "Yards",
          columns: [col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Rushing Touchdowns", source: "rushing", rank: "tds", stat: "TD",
          columns: [col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Receiving Yards", source: "receiving", rank: "yards", stat: "Yards",
          columns: [col("Rec", "receptions"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Receiving Touchdowns", source: "receiving", rank: "tds", stat: "TD",
          columns: [col("Rec", "receptions"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "All-Purpose Yards", source: "totalYards", rank: "total", stat: "Yards",
          columns: [col("Rushing", "rushing"), col("Receiving", "receiving"), col("Total", "total")] },
      ],
    },
    {
      name: "Defense",
      categories: [
        { title: "Total Tackles", source: "defense", rank: "total", stat: "Total", columns: DEFENSE_COLS },
        { title: "Sacks", source: "defense", rank: "sacks", stat: "Sacks", columns: DEFENSE_COLS },
        { title: "Interceptions", source: "defense", rank: "ints", stat: "INT", columns: DEFENSE_COLS },
        { title: "Fumble Recoveries", source: "defense", rank: "fumbleRec", stat: "Fum Rec", columns: DEFENSE_COLS },
        { title: "Defensive Touchdowns", source: "defense", rank: "tds", stat: "TD", columns: DEFENSE_COLS },
      ],
    },
    {
      name: "Special Teams",
      categories: [
        { title: "Kickoff Yards", source: "kicking", rank: "yards", stat: "Yards", columns: KICK_COLS },
        { title: "Kickoff Average", source: "kicking", rank: "avg", stat: "Avg", columns: KICK_COLS },
        { title: "Punting Yards", source: "punting", rank: "yards", stat: "Yards", columns: KICK_COLS },
        { title: "Punting Average", source: "punting", rank: "avg", stat: "Avg", columns: KICK_COLS },
        { title: "Kick Return Yards", source: "kickReturn", rank: "yards", stat: "Yards", columns: KICK_COLS },
        { title: "Punt Return Yards", source: "puntReturn", rank: "yards", stat: "Yards", columns: KICK_COLS },
      ],
    },
  ],

  season: [
    {
      name: "Offense",
      categories: [
        { title: "Touchdowns in a Season", source: "scoring", rank: "tds", stat: "TD", nameKey: "player",
          columns: [col("TD", "tds")] },
        { title: "Passing Yards", source: "passing", rank: "yards", stat: "Yards",
          columns: [col("Comp", "completions"), col("Att", "attempts"), col("Pct", "pct"), col("Yards", "yards"), col("TD", "tds"), col("INT", "ints"), col("Rating", "rating")] },
        { title: "Passing Touchdowns", source: "passing", rank: "tds", stat: "TD",
          columns: [col("Comp", "completions"), col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("INT", "ints")] },
        { title: "Rushing Yards", source: "rushing", rank: "yards", stat: "Yards",
          columns: [col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Rushing Touchdowns", source: "rushing", rank: "tds", stat: "TD",
          columns: [col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Receiving Yards", source: "receiving", rank: "yards", stat: "Yards",
          columns: [col("Rec", "receptions"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Receiving Touchdowns", source: "receiving", rank: "tds", stat: "TD",
          columns: [col("Rec", "receptions"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "All-Purpose Yards", source: "totalYards", rank: "total", stat: "Yards",
          columns: [col("Rushing", "rushing"), col("Receiving", "receiving"), col("Total", "total")] },
      ],
    },
    {
      name: "Defense",
      categories: [
        { title: "Total Tackles", source: "defense", rank: "total", stat: "Total", columns: DEFENSE_COLS },
        { title: "Sacks", source: "defense", rank: "sacks", stat: "Sacks", columns: DEFENSE_COLS },
        { title: "Interceptions", source: "defense", rank: "ints", stat: "INT", columns: DEFENSE_COLS },
        { title: "Fumble Recoveries", source: "defense", rank: "fumbleRec", stat: "Fum Rec", columns: DEFENSE_COLS },
      ],
    },
    {
      name: "Special Teams",
      categories: [
        { title: "Kickoff Yards", source: "kicking", rank: "yards", stat: "Yards", columns: [...KICK_COLS, col("XP", "xp")] },
        { title: "Kickoff Average", source: "kicking", rank: "avg", stat: "Avg", columns: [...KICK_COLS, col("XP", "xp")] },
        { title: "Punting Yards", source: "punting", rank: "yards", stat: "Yards", columns: KICK_COLS },
        { title: "Punting Average", source: "punting", rank: "avg", stat: "Avg", columns: KICK_COLS },
        { title: "Kick Return Yards", source: "kickReturn", rank: "yards", stat: "Yards", columns: KICK_COLS },
        { title: "Punt Return Yards", source: "puntReturn", rank: "yards", stat: "Yards", columns: KICK_COLS },
      ],
    },
  ],

  game: [
    {
      name: "Offense",
      categories: [
        { title: "Touchdowns in a Game", source: "touchdowns", rank: "tds", stat: "TD", columns: [col("TD", "tds")] },
        { title: "Rushing Yards", source: "rushing", rank: "yards", stat: "Yards",
          columns: [col("Yards", "yards"), col("Att", "attempts"), col("YPC", "ypc")] },
        { title: "Passing Yards", source: "passing", rank: "yards", stat: "Yards",
          columns: [col("Yards", "yards"), col("Comp", "completions"), col("Att", "attempts"), col("TD", "tds")] },
        { title: "Receiving Yards", source: "receiving", rank: "yards", stat: "Yards",
          columns: [col("Yards", "yards"), col("Rec", "receptions"), col("TD", "tds")] },
      ],
    },
    {
      name: "Defense",
      categories: [
        { title: "Tackles in a Game", source: "tackles", rank: "tackles", stat: "Tackles", columns: [col("Tackles", "tackles")] },
        { title: "Sacks in a Game", source: "sacks", rank: "sacks", stat: "Sacks", columns: [col("Sacks", "sacks")] },
        { title: "Interceptions in a Game", source: "interceptions", rank: "ints", stat: "INT", columns: [col("INT", "ints")] },
        { title: "Fumble Recoveries in a Game", source: "fumbles", rank: "fumbles", stat: "Fum Rec", columns: [col("Fum Rec", "fumbles")] },
        { title: "Interception & Fumble Return TDs", source: "returnTds", rank: "yards", stat: "Yards", columns: [col("Return Yards", "yards")] },
      ],
    },
    {
      name: "Special Teams",
      categories: [
        { title: "Return Touchdowns", source: "returnTouchdowns", rank: "yards", stat: "Yards",
          columns: [col("Type", "type"), col("Yards", "yards")] },
        { title: "Punt Return Yards", source: "puntReturnYards", rank: "yards", stat: "Yards",
          columns: [col("Returns", "returns"), col("Yards", "yards")] },
      ],
    },
  ],
};

// Columns prepended to every full table, by scope.
const LEAD_COLUMNS = {
  career: [PLAYER],
  season: [YEAR, PLAYER],
  game: [YEAR, OPPONENT, PLAYER],
};

const SCOPE_LABELS = { career: "Career", season: "Single Season", game: "Single Game" };

// ------------------------------------------------------------------ rendering

const cache = new Map();

async function loadScope(scope) {
  if (cache.has(scope)) return cache.get(scope);

  const res = await fetch(`/data/records/${scope}.json`);
  if (!res.ok) throw new Error(`Failed to load ${scope} records (${res.status})`);

  const data = await res.json();
  cache.set(scope, data);
  return data;
}

/** The player/name field varies: single-season scoring uses "player". */
function nameOf(row, category) {
  return row[category.nameKey || "name"] ?? "";
}

function leaderboardLabel(row, scope, category) {
  const name = nameOf(row, category);
  // Many single-season rows have no usable year in the source, so drop the
  // parenthetical entirely rather than printing an empty one.
  if (scope === "season") return row.year ? `${name} (${row.year})` : name;
  if (scope === "game") {
    const opponent = row.playoff ? `${row.opponent} (Playoffs)` : row.opponent;
    return `${name} vs ${opponent}`;
  }
  return name;
}

function buildCategoryCard(scope, category, data) {
  const rows = data[category.source] ?? [];
  const ranked = topBy(rows, category.rank, 10);

  const items = ranked.slice(0, 5).map((row) => ({
    name: leaderboardLabel(row, scope, category),
    value: display(row[category.rank]),
  }));

  const buildFullView = () => {
    const lead = LEAD_COLUMNS[scope].map((c) =>
      // Single-season scoring stores the name under "player".
      c === PLAYER && category.nameKey ? { ...c, key: category.nameKey } : c,
    );
    // The full table is the whole category sorted by the same field, so a
    // reader who opens "Sacks" sees a sack-ordered list, not the source order.
    const sorted = topBy(rows, category.rank, rows.length);
    return buildRecordTable([...lead, ...category.columns], sorted);
  };

  return renderLeaderboardCard(category.title, items, items.length ? buildFullView : null, {
    empty: "No records yet.",
  });
}

function renderScope(scope, data) {
  panel.innerHTML = "";
  panel.setAttribute("aria-labelledby", `tab-${scope}`);

  for (const group of GROUPS[scope]) {
    const section = document.createElement("section");
    section.className = "record-group";

    const heading = document.createElement("h3");
    heading.className = "section-heading";
    heading.textContent = group.name;
    section.appendChild(heading);

    const container = document.createElement("div");
    container.className = "leaderboards-container";

    let rendered = 0;
    for (const category of group.categories) {
      const rows = data[category.source] ?? [];
      if (rows.length === 0) continue;
      container.appendChild(buildCategoryCard(scope, category, data));
      rendered++;
    }

    if (rendered === 0) continue;
    section.appendChild(container);
    panel.appendChild(section);
  }

  if (!panel.children.length) {
    panel.innerHTML = '<p class="empty-state">No records available for this view.</p>';
  }
}

async function showScope(scope) {
  for (const tab of tabs.querySelectorAll(".level-tab")) {
    const active = tab.dataset.scope === scope;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  }

  panel.innerHTML = `<p class="sr-only" role="status">Loading ${SCOPE_LABELS[scope]} records</p>`;

  try {
    renderScope(scope, await loadScope(scope));
  } catch (err) {
    panel.innerHTML = '<p class="empty-state">Couldn\'t load records. Try refreshing.</p>';
  }
}

function init() {
  if (!panel || !tabs) return;

  tabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".level-tab");
    if (!tab) return;
    const { scope } = tab.dataset;
    if (!GROUPS[scope]) return;
    history.replaceState(null, "", scope === "career" ? "/records" : `/records?scope=${scope}`);
    showScope(scope);
  });

  const requested = new URLSearchParams(location.search).get("scope");
  showScope(GROUPS[requested] ? requested : "career");
}

init();
