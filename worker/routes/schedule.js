import { SCHEDULE } from "../lib/schedule.js";

export function handleSchedule(year) {
  const games = (SCHEDULE[year] || []).map((game) => ({
    week: game.week,
    date: game.date,
    opponent: game.opponent || null,
    homeAway: game.homeAway || null,
    label: game.label || null,
    notes: game.notes || null,
  }));

  return Response.json({ year, games });
}
