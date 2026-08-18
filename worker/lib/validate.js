const YEAR_RE = /^\d{4}$/;
const WEEK_RE = /^\d{1,2}$/;

export function isValidYear(year) {
  return YEAR_RE.test(year);
}

export function isValidWeekNum(week) {
  return WEEK_RE.test(week);
}
