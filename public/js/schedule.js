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

async function initBanner() {
  const bannerEl = document.getElementById("photo-banner");
  const trackEl = document.getElementById("photo-banner-track");
  if (!bannerEl || !trackEl) return;

  try {
    const res = await fetch("/api/banner");
    if (!res.ok) throw new Error(`banner ${res.status}`);
    const data = await res.json();
    const images = data.images || [];
    if (images.length === 0) return;

    // The strip scrolls continuously; duplicating the set once lets the
    // animation loop from -50% back to 0% without a visible seam.
    const tiles = [...images, ...images];
    trackEl.innerHTML = "";
    for (const src of tiles) {
      const img = document.createElement("img");
      img.src = src;
      img.loading = "lazy";
      img.alt = "";
      trackEl.appendChild(img);
    }

    // Keeps per-photo scroll speed constant regardless of how many photos
    // are in the set, so adding more later doesn't speed up the loop.
    trackEl.style.animationDuration = `${images.length * 6}s`;

    bannerEl.hidden = false;
  } catch (err) {
    // Decorative only — leave it hidden on failure rather than showing an error.
  }
}

async function init() {
  initBanner();

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
