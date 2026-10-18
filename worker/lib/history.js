import { SCHEDULE } from "./schedule.js";

// A season in progress isn't in history.json yet (that's filled in once the
// season is over), so its played games come from SCHEDULE in the same shape.
// Scrimmages and jamborees have no opponent or result and are left out, as
// they are from past seasons.
function playedScheduleGames(year) {
  return (SCHEDULE[year] || [])
    .filter((game) => game.opponent && game.result)
    .map((game) => ({
      date: game.date,
      opponent: game.opponent,
      homeAway: game.homeAway,
      result: game.result,
      pointsFor: game.pointsFor,
      pointsAgainst: game.pointsAgainst,
    }));
}

// history.json plus any season that's only in SCHEDULE so far. A year that's
// already in history.json always wins, so nothing doubles up once the season
// is written in.
export async function loadHistory(env, origin) {
  const res = await env.ASSETS.fetch(new Request(`${origin}/data/history.json`));
  if (!res.ok) return null;
  const data = await res.json();

  for (const year of Object.keys(SCHEDULE)) {
    if (data[year]) continue;
    const games = playedScheduleGames(year);
    if (games.length > 0) data[year] = games;
  }
  return data;
}
