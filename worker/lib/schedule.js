// The season schedule. Each entry becomes a week on the site in order, shown
// as "Coming soon" (with the opponent/home-away as that week's caption)
// until upload-week.mjs is run for that week's date, at which point real R2
// data takes over automatically. To start a new season, add a new year key
// with its own array of games.
//
// Week numbers: "01".."09" are regular-season weeks and drive the "Week N"
// label, with 10+ left free for playoff weeks. Preseason and other one-off
// events use **90-99** and carry an explicit `label` instead, because they
// fall between numbered weeks with no integer available to express that (a
// jamboree on Aug 21 sits between week 01's Aug 28 opener and the Aug 15
// scrimmage). Ordering on the site comes from the date, not the number —
// see compareWeeks in routes/weeks.js. The Blue & Gold Scrimmage predates
// this convention and stays at "00" so its shared "?week=0" links keep
// working.
export const SCHEDULE = {
  "2026": [
    { week: "00", date: "2026-08-15", label: "Blue & Gold Scrimmage" },
    // Preseason/exhibition entries use week numbers 90-99 (see the note above
    // the SCHEDULE export). Keep this array in date order — /schedule renders
    // it as-is and picks its "next game" highlight by scanning it.
    { week: "90", date: "2026-08-21", label: "Festus Jamboree" },
    { week: "01", date: "2026-08-28", opponent: "Oakville", homeAway: "Home", cover: "/oakvillelogoWeek12026.avif" },
    { week: "02", date: "2026-09-04", opponent: "North Point", homeAway: "Home" },
    { week: "03", date: "2026-09-11", opponent: "Lindbergh", homeAway: "Away" },
    { week: "04", date: "2026-09-18", opponent: "Pattonville", homeAway: "Away" },
    { week: "05", date: "2026-09-25", opponent: "Fox", homeAway: "Home" },
    { week: "06", date: "2026-10-02", opponent: "Hazelwood Central", homeAway: "Home", notes: "Homecoming" },
    { week: "07", date: "2026-10-08", opponent: "Hazelwood East", homeAway: "Away" },
    { week: "08", date: "2026-10-16", opponent: "Ritenour", homeAway: "Home", notes: "Senior Night" },
    { week: "09", date: "2026-10-23", opponent: "Parkway North", homeAway: "Away" },
  ],
};

// Kickoff time for games that don't specify their own.
const DEFAULT_KICKOFF = "19:00";

// The team plays in Central Time. Rather than pull in a timezone library,
// work out the US DST rule directly: DST runs from the second Sunday in
// March to the first Sunday in November, during which Central is UTC-5
// instead of UTC-6.
function centralOffset(year, month, day) {
  function nthSunday(m, n) {
    const first = new Date(Date.UTC(year, m, 1));
    const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
    return firstSunday + (n - 1) * 7;
  }

  if (month < 2 || month > 10) return 6; // Jan, Feb, Dec
  if (month > 2 && month < 10) return 5; // Apr through Oct
  if (month === 2) return day >= nthSunday(2, 2) ? 5 : 6; // March
  return day < nthSunday(10, 1) ? 5 : 6; // November
}

// Returns the game's kickoff as an unambiguous ISO instant, e.g.
// "2026-08-28T19:00:00-05:00", so clients can count down to it correctly
// no matter what timezone the visitor is in.
export function kickoffInstant(game) {
  const [year, month, day] = game.date.split("-").map(Number);
  const time = game.time || DEFAULT_KICKOFF;
  const offset = centralOffset(year, month - 1, day);
  return `${game.date}T${time}:00-0${offset}:00`;
}

// The next game that hasn't kicked off yet, across every scheduled season.
// Returns null once the last game on the schedule has started. Only counts
// entries with a single opponent — the countdown reads "Home vs. X", which
// doesn't fit something like an intrasquad scrimmage.
export function nextGame(now = new Date()) {
  const upcoming = Object.values(SCHEDULE)
    .flat()
    .filter((game) => game.opponent)
    .map((game) => ({ game, at: new Date(kickoffInstant(game)) }))
    .filter((entry) => entry.at > now)
    .sort((a, b) => a.at - b.at);

  return upcoming.length > 0 ? upcoming[0] : null;
}

export function findScheduledGame(year, weekNum) {
  return (SCHEDULE[year] || []).find((game) => game.week === weekNum) || null;
}

// Not every entry is a game against a single opponent (e.g. a preseason
// scrimmage) — those fall back to their label rather than producing
// "undefined vs. undefined".
export function scheduleCaption(game) {
  const base = game.opponent ? `${game.homeAway} vs. ${game.opponent}` : game.label;
  if (!base) return null;
  return game.notes ? `${base} (${game.notes})` : base;
}
