// Current players' names on the record book and history leaderboards link to
// their /player pages. Shared with player.js, which reads the same roster.

let rosterPromise = null;

export function loadRoster() {
  rosterPromise ||= fetch("/data/roster.json")
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  return rosterPromise;
}

// The earliest season someone on this roster could have played: a senior's
// freshman year. A season entry older than that belongs to an alum who
// happens to share the name. Career and single-game labels carry no year
// and are linked on the name alone.
export function earliestSeason(roster) {
  return roster.year - 3;
}

// Labels read "Name", "Name (2025)" or "Name vs Opponent".
export async function linkRosterNames(root) {
  const roster = await loadRoster();
  if (!roster || !root) return;
  const minYear = earliestSeason(roster);

  for (const span of root.querySelectorAll(".leaderboard-item .player")) {
    if (span.querySelector("a")) continue;
    const text = span.textContent;
    const player = roster.players.find((p) => text === p.name || text.startsWith(`${p.name} `));
    if (!player) continue;
    const year = Number(text.match(/\((\d{4})\)/)?.[1]);
    if (year && year < minYear) continue;

    const link = document.createElement("a");
    link.href = `/player?n=${player.number}`;
    link.textContent = player.name;
    span.replaceChildren(link, text.slice(player.name.length));
  }
}
