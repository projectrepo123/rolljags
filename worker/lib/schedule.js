// The season schedule. Each entry becomes a week on the site in order, shown
// as "Coming soon" (with the opponent/home-away as that week's caption)
// until upload-week.mjs is run for that week's date, at which point real R2
// data takes over automatically. To start a new season, add a new year key
// with its own array of games.
export const SCHEDULE = {
  "2026": [
    { week: "01", date: "2026-08-28", opponent: "Oakville", homeAway: "Home" },
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

export function findScheduledGame(year, weekNum) {
  return (SCHEDULE[year] || []).find((game) => game.week === weekNum) || null;
}

export function scheduleCaption(game) {
  const base = `${game.homeAway} vs. ${game.opponent}`;
  return game.notes ? `${base} (${game.notes})` : base;
}
