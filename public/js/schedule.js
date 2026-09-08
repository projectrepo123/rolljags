const params = new URLSearchParams(location.search);
// The season schedule.html is written for. Any other year is fetched the same
// way, but has to say which year it is in the heading.
const DEFAULT_YEAR = "2026";
const year = params.get("year") || DEFAULT_YEAR;

const titleEl = document.getElementById("schedule-title");
const tbodyEl = document.getElementById("schedule-tbody");
const statusEl = document.getElementById("schedule-status");

function weekUrl(week) {
  return `/week?year=${encodeURIComponent(year)}&week=${encodeURIComponent(week)}`;
}

function gameDateLabel(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function render(games) {
  // The static HTML already carries the current season's heading; only a
  // request for a different year needs the year spelled out. Rewriting it
  // unconditionally would strip the team name back out of the page's one <h1>.
  if (year !== DEFAULT_YEAR) {
    titleEl.textContent = `${year} Seckman Jaguars Football Schedule`;
    document.title = `${year} Seckman Jaguars Football Schedule | Imperial, MO`;
  }

  tbodyEl.innerHTML = "";

  if (games.length === 0) {
    statusEl.innerHTML = '<p class="empty-state">No schedule posted for this season yet.</p>';
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextIndex = games.findIndex((g) => new Date(`${g.date}T12:00:00`) >= today);

  games.forEach((game, i) => {
    const tr = document.createElement("tr");
    const gameDate = new Date(`${game.date}T12:00:00`);
    if (i === nextIndex) tr.className = "schedule-next";
    else if (gameDate < today) tr.className = "schedule-past";

    const dateCell = document.createElement("td");
    dateCell.textContent = gameDateLabel(game.date);
    tr.appendChild(dateCell);

    const opponentCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = weekUrl(game.week);
    link.textContent = game.opponent || game.label || "TBD";
    opponentCell.appendChild(link);
    tr.appendChild(opponentCell);

    const locationCell = document.createElement("td");
    locationCell.textContent = game.homeAway ? (game.homeAway === "Home" ? "H" : "A") : "—";
    tr.appendChild(locationCell);

    const notesCell = document.createElement("td");
    notesCell.textContent = game.notes || "";
    tr.appendChild(notesCell);

    tbodyEl.appendChild(tr);
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
