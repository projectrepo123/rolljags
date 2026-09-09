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

// A photo's R2 key doubles as its like-counter ID, so it arrives from the
// client and has to be checked before it's used to build a KV key. Anchored
// and built from the same pieces the rest of the site already validates:
// "2026/week-01_2026-08-28/varsity/IMG_0001.jpg".
//
// Deliberately strict about the filename. The character class excludes "/"
// and the dot-run check rejects "..", so a crafted key can't climb out of its
// week folder or collide with an unrelated counter.
const PHOTO_KEY_RE = new RegExp(
  "^\\d{4}/week-\\d{1,2}_\\d{4}-\\d{2}-\\d{2}/" +
    LEVEL_RE.source.replace(/^\^|\$$/g, "") +
    "/[A-Za-z0-9._-]{1,128}\\.(jpe?g|png|webp|avif)$",
  "i",
);

export function isValidPhotoKey(key) {
  return typeof key === "string" && !key.includes("..") && PHOTO_KEY_RE.test(key);
}
