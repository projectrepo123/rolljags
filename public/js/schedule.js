const params = new URLSearchParams(location.search);
const year = params.get("year") || "2026";

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
  titleEl.textContent = `${year} Schedule`;
  document.title = `${year} Schedule | Jaguar Football`;

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
