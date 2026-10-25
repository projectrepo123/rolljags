// /roster: turns the table rows the worker wrote into the page (see
// worker/lib/roster.js) into a roster grouped by position, the way team sites
// list one: Offense, Defense, Special Teams, each split into position groups
// of compact rows. The unit chips jump to a unit; the class chips filter.
// The table stays in the HTML for crawlers and no-JS visitors.

const tbody = document.getElementById("roster-tbody");
const tableEl = document.getElementById("roster-table");
const listEl = document.getElementById("roster-grid");
const filtersEl = document.getElementById("roster-filters");

// A two-way player ("WR/K") is listed once, under his first position.
const UNITS = [
  {
    name: "Offense",
    groups: [
      ["Quarterbacks", ["QB"]],
      ["Running Backs", ["RB", "TB", "FB"]],
      ["Receivers & Tight Ends", ["WR", "TE"]],
      ["Offensive Line", ["OL"]],
    ],
  },
  {
    name: "Defense",
    groups: [
      ["Defensive Line", ["DL", "DE"]],
      ["Linebackers", ["LB"]],
      ["Defensive Backs", ["DB"]],
    ],
  },
  {
    name: "Special Teams",
    groups: [["Specialists", ["K", "P", "LS"]]],
  },
];
const CLASSES = { Seniors: "Sr.", Juniors: "Jr.", Sophomores: "So.", Freshmen: "Fr." };

let classFilter = "All";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

function readPlayers() {
  return [...tbody.querySelectorAll("tr[data-number]")].map((tr) => ({
    number: Number(tr.dataset.number),
    name: tr.querySelector(".roster-name").textContent.trim(),
    pos: tr.dataset.pos,
    cls: tr.dataset.class,
  }));
}

function row(player) {
  const li = el("li", "roster-row");
  li.dataset.class = player.cls;
  const link = el("a", "rr-link");
  link.href = `/player?n=${player.number}`;
  const num = el("span", "rr-num", String(player.number));
  num.setAttribute("aria-hidden", "true");
  const text = el("span", "rr-text");
  const name = el("span", "rr-name", player.name);
  // The number is visible in the badge; screen readers get it with the name.
  name.setAttribute("aria-label", `#${player.number} ${player.name}`);
  text.append(name, el("span", "rr-meta", `${player.pos} · ${player.cls}`));
  link.append(num, text);
  li.appendChild(link);
  return li;
}

function render(players) {
  const placed = new Set();
  for (const unit of UNITS) {
    const section = el("section", "roster-unit");
    section.id = slug(unit.name);
    section.appendChild(el("h2", "section-heading", unit.name));

    for (const [title, positions] of unit.groups) {
      const members = players
        .filter((p) => !placed.has(p) && positions.includes(p.pos.split("/")[0]))
        .sort((a, b) => a.number - b.number);
      if (members.length === 0) continue;
      members.forEach((p) => placed.add(p));

      const group = el("div", "roster-group");
      const heading = el("h3", "roster-group-title", title);
      heading.appendChild(el("span", "roster-group-count", ""));
      group.appendChild(heading);
      const list = el("ul", "roster-rows");
      list.append(...members.map(row));
      group.appendChild(list);
      section.appendChild(group);
    }
    if (section.querySelector(".roster-group")) listEl.appendChild(section);
  }

  // Anyone at a position not listed above still shows, rather than vanishing.
  const rest = players.filter((p) => !placed.has(p));
  if (rest.length) {
    const section = el("section", "roster-unit");
    section.appendChild(el("h2", "section-heading", "Others"));
    const list = el("ul", "roster-rows");
    list.append(...rest.map(row));
    section.appendChild(list);
    listEl.appendChild(section);
  }
}

let countEl;

function applyFilter() {
  let shown = 0;
  for (const group of listEl.querySelectorAll(".roster-group, .roster-unit")) {
    for (const li of group.querySelectorAll(":scope > .roster-rows > .roster-row")) {
      const visible = classFilter === "All" || li.dataset.class === CLASSES[classFilter];
      li.hidden = !visible;
      if (visible) shown++;
    }
  }
  for (const group of listEl.querySelectorAll(".roster-group")) {
    const visible = group.querySelectorAll(".roster-row:not([hidden])").length;
    group.hidden = visible === 0;
    group.querySelector(".roster-group-count").textContent = String(visible);
  }
  for (const unit of listEl.querySelectorAll(".roster-unit")) {
    unit.hidden = !unit.querySelector(".roster-row:not([hidden])");
  }
  countEl.textContent = `${shown} player${shown === 1 ? "" : "s"}`;
}

function buildFilters(players) {
  const jump = el("nav", "chip-group");
  jump.setAttribute("aria-label", "Jump to unit");
  const jumpLabel = el("span", "chip-label", "Jump to");
  jumpLabel.setAttribute("aria-hidden", "true");
  jump.appendChild(jumpLabel);
  for (const unit of UNITS) {
    const link = el("a", "chip", unit.name);
    link.href = `#${slug(unit.name)}`;
    jump.appendChild(link);
  }

  const classes = el("div", "chip-group");
  classes.setAttribute("role", "group");
  classes.setAttribute("aria-label", "Class");
  const classLabel = el("span", "chip-label", "Class");
  classLabel.setAttribute("aria-hidden", "true");
  classes.appendChild(classLabel);
  const options = ["All", ...Object.keys(CLASSES).filter((c) => players.some((p) => p.cls === CLASSES[c]))];
  for (const option of options) {
    const chip = el("button", "chip", option);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(option === classFilter));
    chip.addEventListener("click", () => {
      classFilter = option;
      for (const c of classes.querySelectorAll("button.chip")) c.setAttribute("aria-pressed", String(c === chip));
      applyFilter();
    });
    classes.appendChild(chip);
  }

  countEl = el("p", "roster-count");
  countEl.setAttribute("role", "status");
  filtersEl.append(jump, classes, countEl);
}

function init() {
  if (!tbody || !listEl) return;
  const players = readPlayers();
  if (players.length === 0) return;

  buildFilters(players);
  render(players);
  applyFilter();

  filtersEl.hidden = false;
  listEl.hidden = false;
  tableEl.hidden = true;
}

init();
