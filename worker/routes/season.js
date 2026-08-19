// Looks up a season's win/loss record for meta-tag purposes. Returns null
// if the year isn't present in history.json (invalid or not-yet-played).
export async function getSeasonSummary(env, origin, year) {
  const res = await env.ASSETS.fetch(new Request(`${origin}/data/history.json`));
  if (!res.ok) return null;

  const data = await res.json();
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
