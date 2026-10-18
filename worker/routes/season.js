import { loadHistory } from "../lib/history.js";

// Looks up a season's win/loss record for meta-tag purposes. Returns null
// if the year has no played games (invalid or not started yet).
export async function getSeasonSummary(env, origin, year) {
  const data = await loadHistory(env, origin);
  if (!data) return null;

  const games = data[year];
  if (!games) return null;

  let wins = 0, losses = 0, ties = 0;
  for (const game of games) {
    if (game.result === "W") wins++;
    else if (game.result === "L") losses++;
    else ties++;
  }

  let record = `${wins}-${losses}`;
  if (ties > 0) record += `-${ties}`;

  return { year, record };
}
