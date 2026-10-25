const params = new URLSearchParams(location.search);
// The season schedule.html is written for. Any other year is fetched the same
// way, but has to say which year it is in the heading.
const DEFAULT_YEAR = "2026";
const year = params.get("year") || DEFAULT_YEAR;

const titleEl = document.getElementById("schedule-title");
// The edge can serve HTML cached before the schedule moved from a table to
// cards for a few minutes after a deploy. Swap the old table for the list
// rather than failing.
const listEl = document.getElementById("game-list") || replaceLegacyTable();
const statsEl = document.getElementById("schedule-stats");
const statusEl = document.getElementById("schedule-status");

const RESULT_WORD = { W: "Win", L: "Loss", T: "Tie" };
const RESULT_CLASS = { W: "win", L: "loss", T: "tie" };

function replaceLegacyTable() {
  const list = document.createElement("ol");
  list.className = "game-list";
  document.getElementById("schedule-table")?.closest(".table-scroll")?.replaceWith(list);
  return list;
}

function weekUrl(week) {
  return `/week?year=${encodeURIComponent(year)}&week=${encodeURIComponent(week)}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Noon, so the date never slips a day in a timezone west of Central.
function gameDate(game) {
  return new Date(`${game.date}T12:00:00`);
}

function kickoffTime(game) {
  return new Date(game.kickoff).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

// "8-1", or "8-1-1" once there's a tie.
function record(games) {
  const count = (r) => games.filter((g) => g.result === r).length;
  const [w, l, t] = [count("W"), count("L"), count("T")];
  return t ? `${w}-${l}-${t}` : `${w}-${l}`;
}

// The season so far, for the row of numbers in the page hero.
function seasonStats(games) {
  const played = games.filter((g) => g.result);
  if (played.length === 0) return [];

  const pointsFor = played.reduce((sum, g) => sum + g.pointsFor, 0);
  const pointsAgainst = played.reduce((sum, g) => sum + g.pointsAgainst, 0);

  let streak = 0;
  const last = played[played.length - 1].result;
  for (let i = played.length - 1; i >= 0 && played[i].result === last; i--) streak++;

  return [
    ["Record", record(played)],
    ["Home", record(played.filter((g) => g.homeAway === "Home"))],
    ["Away", record(played.filter((g) => g.homeAway === "Away"))],
    ["Points for", String(pointsFor)],
    ["Points against", String(pointsAgainst)],
    ["Streak", `${last}${streak}`],
  ];
}

function renderStats(games) {
  const stats = seasonStats(games);
  if (!statsEl || stats.length === 0) return;
  statsEl.innerHTML = "";
  for (const [label, value] of stats) {
    const item = el("div", "hero-stat");
    item.append(el("dt", "", label), el("dd", "", value));
    statsEl.appendChild(item);
  }
  statsEl.hidden = false;
}

// The opponent's crest on a white badge, or the Jaguar for an intrasquad
// scrimmage or a jamboree.
function logoSlot(game) {
  const slot = el("div", "gc-logo");
  const img = el("img", "logo-badge");
  img.src = game.logo || "/logo.webp";
  img.alt = "";
  img.loading = "lazy";
  slot.appendChild(img);
  return slot;
}

function dateBlock(game) {
  const date = gameDate(game);
  const block = el("div", "gc-date");
  block.append(
    el("span", "gc-dow", date.toLocaleDateString("en-US", { weekday: "short" })),
    el("span", "gc-day", String(date.getDate())),
    el("span", "gc-mon", date.toLocaleDateString("en-US", { month: "short" }))
  );
  return block;
}

// The same angled slab the home page cards use, so a final looks the same
// everywhere on the site.
function scoreSlab(game) {
  const score = el("div", "wc-score");
  score.setAttribute("aria-label", `${RESULT_WORD[game.result] || game.result} ${game.pointsFor} to ${game.pointsAgainst}`);
  score.append(
    el("b", "us", String(game.pointsFor)),
    el("i", "dash"),
    el("b", "them", String(game.pointsAgainst)),
    el("span", "res", RESULT_WORD[game.result] || game.result)
  );
  return score;
}

function renderBye(game) {
  const li = el("li", "game-card bye");
  const row = el("div", "game-row");
  row.appendChild(dateBlock(game));
  row.appendChild(el("span", "gc-bye", "Bye week"));
  li.appendChild(row);
  return li;
}

function renderGame(game, state) {
  const li = el("li", `game-card ${RESULT_CLASS[game.result] || "plain"}`);
  if (state === "next") li.classList.add("is-next");

  const row = el("a", "game-row");
  row.href = weekUrl(game.week);

  row.appendChild(dateBlock(game));
  row.appendChild(logoSlot(game));

  const matchup = el("div", "gc-matchup");
  if (game.opponent) matchup.appendChild(el("span", "wc-kick", game.homeAway === "Away" ? "At" : "Vs"));
  matchup.appendChild(el("span", "gc-opp", game.opponent || game.label || "TBD"));
  if (game.notes) matchup.appendChild(el("span", "gc-tag", game.notes));
  row.appendChild(matchup);

  const result = el("div", "gc-result");
  if (game.result) {
    result.appendChild(scoreSlab(game));
  } else if (state === "next") {
    result.appendChild(el("span", "gc-status gc-status-next", `Next game · ${kickoffTime(game)}`));
  } else if (state === "upcoming") {
    result.appendChild(el("span", "gc-status", kickoffTime(game)));
  } else if (game.opponent) {
    // Played, but the score isn't in yet.
    result.appendChild(el("span", "gc-status", "Final score coming"));
  }
  row.appendChild(result);

  const cta = el("span", "gc-cta", state === "past" ? "Photos" : "Game page");
  cta.setAttribute("aria-hidden", "true");
  row.appendChild(cta);

  li.appendChild(row);
  return li;
}

function render(games) {
  // The static HTML already carries the current season's heading; only a
  // request for a different year needs the year spelled out. Rewriting it
  // unconditionally would strip the team name back out of the page's one <h1>.
  if (year !== DEFAULT_YEAR) {
    titleEl.lastChild.textContent = ` ${year} Schedule`;
    document.title = `${year} Seckman Jaguars Football Schedule | Imperial, MO`;
  }

  listEl.innerHTML = "";

  if (games.length === 0) {
    statusEl.innerHTML = '<p class="empty-state">No schedule posted for this season yet.</p>';
    return;
  }

  renderStats(games);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextIndex = games.findIndex((g) => !g.bye && gameDate(g) >= today);

  games.forEach((game, i) => {
    if (game.bye) {
      listEl.appendChild(renderBye(game));
      return;
    }
    const state = i === nextIndex ? "next" : gameDate(game) < today ? "past" : "upcoming";
    listEl.appendChild(renderGame(game, state));
  });
}

async function init() {
  if (!/^\d{4}$/.test(year)) {
    titleEl.textContent = "Schedule not found";
    return;
  }

  try {
    const res = await fetch(`/api/schedule/${encodeURIComponent(year)}`);
    if (!res.ok) throw new Error(`schedule ${res.status}`);
    const data = await res.json();
    render(data.games);
  } catch (err) {
    titleEl.textContent = "Couldn't load the schedule";
    statusEl.innerHTML = '<p class="empty-state">Couldn\'t load the schedule right now. Try refreshing.</p>';
  }
}

init();
