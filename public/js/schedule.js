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

// The weekday sits in its own span so phones can drop it and keep the date on
// one line.
function dateCellContent(cell, dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  const weekday = document.createElement("span");
  weekday.className = "date-weekday";
  weekday.textContent = `${date.toLocaleDateString("en-US", { weekday: "short" })}, `;
  cell.append(weekday, date.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
}

function render(games) {
  // The static HTML already carries the current season's heading; only a
  // request for a different year needs the year spelled out. Rewriting it
  // unconditionally would strip the team name back out of the page's one <h1>.
  if (year !== DEFAULT_YEAR) {
    titleEl.lastChild.textContent = ` ${year} Schedule`;
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
    if (i === nextIndex) tr.classList.add("schedule-next");
    else if (gameDate < today) tr.classList.add("schedule-past");
    if (game.result) tr.classList.add(game.result === "W" ? "game-win" : game.result === "L" ? "game-loss" : "game-tie");

    const dateCell = document.createElement("td");
    dateCellContent(dateCell, game.date);
    tr.appendChild(dateCell);

    const opponentCell = document.createElement("td");
    opponentCell.className = "opponent-cell";
    if (game.logo) {
      const logo = document.createElement("img");
      logo.className = "opp-logo";
      logo.src = game.logo;
      logo.width = 24;
      logo.height = 24;
      logo.alt = "";
      logo.loading = "lazy";
      opponentCell.appendChild(logo);
    }
    const link = document.createElement("a");
    link.href = weekUrl(game.week);
    link.textContent = game.opponent || game.label || "TBD";
    opponentCell.appendChild(link);
    // Phones hide the Notes column, so the note rides under the opponent.
    if (game.notes) {
      const note = document.createElement("span");
      note.className = "row-note";
      note.textContent = game.notes;
      opponentCell.appendChild(note);
    }
    tr.appendChild(opponentCell);

    const locationCell = document.createElement("td");
    if (game.homeAway) {
      const isHome = game.homeAway === "Home";
      const loc = document.createElement("span");
      loc.className = `loc-badge ${isHome ? "loc-home" : "loc-away"}`;
      loc.textContent = isHome ? "H" : "A";
      // The cell shows a letter; the tooltip spells it out.
      loc.title = game.homeAway;
      locationCell.appendChild(loc);
    }
    tr.appendChild(locationCell);

    const resultCell = document.createElement("td");
    resultCell.className = "result-cell";
    if (game.result) {
      resultCell.textContent = `${game.result} ${game.pointsFor}-${game.pointsAgainst}`;
    } else if (gameDate >= today && game.kickoff) {
      // Upcoming games show their kickoff, and the next one says so.
      const time = new Date(game.kickoff).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      });
      if (i === nextIndex) {
        const chip = document.createElement("span");
        chip.className = "next-chip";
        chip.textContent = `Next · ${time}`;
        resultCell.appendChild(chip);
      } else {
        resultCell.textContent = time;
        resultCell.classList.add("result-upcoming");
      }
    }
    tr.appendChild(resultCell);

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
