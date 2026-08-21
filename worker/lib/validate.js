const YEAR_RE = /^\d{4}$/;
const WEEK_RE = /^\d{1,2}$/;
// Level/group folder names aren't a fixed enum (see findWeekLevels in
// lib/r2.js) — this just keeps the value safe to drop into an R2 key and a
// URL segment before it's used to build the zip-download prefix.
const LEVEL_RE = /^[a-z0-9-]{1,32}$/;

export function isValidYear(year) {
  return YEAR_RE.test(year);
}

export function isValidWeekNum(week) {
  return WEEK_RE.test(week);
}

export function isValidLevel(level) {
  return LEVEL_RE.test(level);
}
