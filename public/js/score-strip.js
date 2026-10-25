// The season's games in a thin band under the header, the way a league site
// shows a scores ticker. Each game links to its week page. Pages opt in with
// an empty <nav class="score-strip" data-year="..."> right after the header;
// a week page passes its own ?year= so an old season shows that season.

const strip = document.getElementById("score-strip");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortDate(game) {
  return new Date(`${game.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function kickoffTime(game) {
  return new Date(game.kickoff).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

function item(game, year, state, currentWeek) {
  if (game.bye) {
    const bye = el("span", "ss-item bye");
    bye.append(el("span", "ss-opp", "Bye"), el("span", "ss-res", shortDate(game)));
    return bye;
  }

  const link = el("a", `ss-item ${{ W: "win", L: "loss", T: "tie" }[game.result] || ""}`.trim());
  link.href = `/week?year=${encodeURIComponent(year)}&week=${encodeURIComponent(game.week)}`;
  if (game.week === currentWeek) link.setAttribute("aria-current", "page");
  if (state === "next") link.classList.add("is-next");

  const logo = el("img", "ss-logo");
  logo.src = game.logo || "/logo.webp";
  logo.alt = "";
  logo.width = 22;
  logo.height = 22;
  link.appendChild(logo);

  const name = game.opponent ? `${game.homeAway === "Away" ? "at" : "vs"} ${game.opponent}` : game.label;
  link.appendChild(el("span", "ss-opp", name));

  let result;
  if (game.result) result = `${game.result} ${game.pointsFor}-${game.pointsAgainst}`;
  else if (state === "past") result = shortDate(game);
  else result = `${shortDate(game)} · ${kickoffTime(game)}`;
  link.appendChild(el("span", "ss-res", result));

  link.title = [name, shortDate(game), game.notes].filter(Boolean).join(" · ");
  return link;
}

async function init() {
  if (!strip) return;
  const params = new URLSearchParams(location.search);
  const year = /^\d{4}$/.test(params.get("year") || "") ? params.get("year") : strip.dataset.year;
  const currentWeek = params.get("week");

  try {
    const res = await fetch(`/api/schedule/${encodeURIComponent(year)}`);
    if (!res.ok) throw new Error(`schedule ${res.status}`);
    const { games } = await res.json();
    // Scrimmages and jamborees aren't results; leave them to /schedule.
    const shown = games.filter((g) => g.opponent || g.bye);
    if (shown.length === 0) throw new Error("no games");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextIndex = shown.findIndex((g) => !g.bye && new Date(`${g.date}T12:00:00`) >= today);

    const track = el("div", "container score-strip-track");
    shown.forEach((game, i) => {
      const state = i === nextIndex ? "next" : new Date(`${game.date}T12:00:00`) < today ? "past" : "upcoming";
      track.appendChild(item(game, year, state, currentWeek));
    });
    strip.appendChild(track);

    // Start scrolled to this week's game, or the next one, with the games
    // just before it still in view.
    const focus = track.querySelector('[aria-current="page"], .is-next');
    if (focus) track.scrollLeft = Math.max(0, focus.offsetLeft - track.offsetLeft - track.clientWidth / 3);
  } catch (err) {
    strip.remove();
  }
}

init();
