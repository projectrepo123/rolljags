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
import { GROUPS, LEAD_COLUMNS, SCOPE_LABELS, PLAYER, leaderboardLabel } from "./records-config.js";
import { linkRosterNames } from "./roster-links.js";

const panel = document.getElementById("scope-panel");
const tabs = document.getElementById("scope-tabs");

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

    const heading = document.createElement("h2");
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
    return;
  }

  linkRosterNames(panel);
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
