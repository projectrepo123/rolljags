// /roster: turns the table rows the worker wrote into the page (see
// worker/lib/roster.js) into a grid of jersey cards with position and class
// filters. The table stays in the HTML for crawlers and no-JS visitors.

const tbody = document.getElementById("roster-tbody");
const tableEl = document.getElementById("roster-table");
const gridEl = document.getElementById("roster-grid");
const filtersEl = document.getElementById("roster-filters");

// A two-way player ("WR/K") belongs to both groups.
const UNITS = {
  Offense: ["QB", "RB", "TB", "FB", "WR", "TE", "OL"],
  Defense: ["DL", "DE", "LB", "DB"],
  "Special Teams": ["K", "P", "LS"],
};
const CLASSES = { Seniors: "Sr.", Juniors: "Jr.", Sophomores: "So.", Freshmen: "Fr." };

const state = { unit: "All", cls: "All" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readPlayers() {
  return [...tbody.querySelectorAll("tr[data-number]")].map((tr) => ({
    number: Number(tr.dataset.number),
    name: tr.querySelector(".roster-name").textContent.trim(),
    pos: tr.dataset.pos,
    cls: tr.dataset.class,
  }));
}

function inUnit(player, unit) {
  if (unit === "All") return true;
  return player.pos.split("/").some((p) => UNITS[unit].includes(p));
}

function card(player) {
  const li = el("li", "player-card");
  li.dataset.number = player.number;
  const link = el("a", "pc-link");
  link.href = `/player?n=${player.number}`;
  const num = el("span", "pc-num", String(player.number));
  num.setAttribute("aria-hidden", "true");
  link.append(num, el("span", "pc-name", player.name), el("span", "pc-meta", `#${player.number} · ${player.pos} · ${player.cls}`));
  li.appendChild(link);
  return li;
}

function chipGroup(label, options, key, players) {
  const group = el("div", "chip-group");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);
  const heading = el("span", "chip-label", label);
  heading.setAttribute("aria-hidden", "true");
  group.appendChild(heading);
  for (const option of options) {
    const chip = el("button", "chip", option);
    chip.type = "button";
    chip.dataset.value = option;
    chip.setAttribute("aria-pressed", String(state[key] === option));
    chip.addEventListener("click", () => {
      state[key] = option;
      for (const c of group.querySelectorAll(".chip")) c.setAttribute("aria-pressed", String(c === chip));
      applyFilters(players);
    });
    group.appendChild(chip);
  }
  return group;
}

let countEl;

function applyFilters(players) {
  let shown = 0;
  for (const li of gridEl.children) {
    const player = players.find((p) => p.number === Number(li.dataset.number));
    const visible = inUnit(player, state.unit) && (state.cls === "All" || player.cls === CLASSES[state.cls]);
    li.hidden = !visible;
    if (visible) shown++;
  }
  countEl.textContent = `${shown} player${shown === 1 ? "" : "s"}`;
}

function init() {
  if (!tbody || !gridEl) return;
  const players = readPlayers();
  if (players.length === 0) return;

  const classOptions = ["All", ...Object.keys(CLASSES).filter((c) => players.some((p) => p.cls === CLASSES[c]))];
  filtersEl.append(
    chipGroup("Unit", ["All", ...Object.keys(UNITS)], "unit", players),
    chipGroup("Class", classOptions, "cls", players)
  );
  countEl = el("p", "roster-count");
  countEl.setAttribute("role", "status");
  filtersEl.appendChild(countEl);

  for (const player of players) gridEl.appendChild(card(player));
  applyFilters(players);

  filtersEl.hidden = false;
  gridEl.hidden = false;
  tableEl.hidden = true;
}

init();
