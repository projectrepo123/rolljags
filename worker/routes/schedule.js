import { SCHEDULE, kickoffInstant } from "../lib/schedule.js";

// Shared by the JSON API and the SportsEvent structured data injected into
// /schedule, so both describe the same season from the same source.
export function scheduleGames(year) {
  return (SCHEDULE[year] || []).map((game) => ({
    week: game.week,
    date: game.date,
    opponent: game.opponent || null,
    homeAway: game.homeAway || null,
    label: game.label || null,
    notes: game.notes || null,
    // Structured data wants a real instant, not a bare date. The client
    // ignores this field.
    kickoff: kickoffInstant(game),
  }));
}

export function handleSchedule(year) {
  return Response.json({ year, games: scheduleGames(year) });
}
