// Picking one item out of a list and holding that choice for a day.
//
// Used for the homepage cover photos: a week's card shows a different shot from
// that week's gallery each day, but the same one all day however many times the
// page is reloaded. There's nothing stored anywhere — the date is the seed, so
// every request on the same day computes the same answer independently.

// The team's timezone, not UTC. Keyed off UTC the day would roll over at 7pm
// local, mid-evening, which is exactly when people are looking at the site.
const TEAM_TZ = "America/Chicago";

// "2026-09-08". en-CA formats as ISO, which is what makes this sortable and
// stable to compare, though only its identity actually matters here.
export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TEAM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// FNV-1a, 32-bit. Any deterministic string hash would do; this one is four
// lines and has no dependencies. Math.imul keeps the multiply in 32-bit
// integer space, which a plain * would not.
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Deterministic pick from `items` for a given seed. Callers pass a seed that
// includes todayKey(), so the choice changes when the date does and not
// otherwise. Requires `items` to be in a stable order across requests — see
// the sort in listObjects().
export function pickDaily(items, seed) {
  if (!items || items.length === 0) return null;
  return items[hash32(seed) % items.length];
}
