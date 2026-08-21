// The three roster levels are the common case, but a week's photos don't have
// to be split by roster level at all — a scrimmage or a one-off shoot might
// instead hold a curated "Instagram picks" set alongside the full take.
// Both are just named folders directly under the week (see findWeekLevels),
// so nothing here is hardcoded to a fixed list. LEVELS itself only remains
// as the set upload-week.mjs's README examples point to.
export const LEVELS = ["varsity", "jv", "freshman"];

const LEVEL_LABELS = {
  varsity: "Varsity",
  jv: "JV",
  freshman: "Freshman",
  instagram: "Instagram Pics",
  full: "Full Gallery",
};

// Known groups display in this order; an unrecognized folder name sorts
// after them, alphabetically.
const LEVEL_ORDER = ["varsity", "jv", "freshman", "instagram", "full"];

export function levelLabel(level) {
  return LEVEL_LABELS[level] || level.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function levelRank(level) {
  const i = LEVEL_ORDER.indexOf(level);
  return i === -1 ? LEVEL_ORDER.length : i;
}

export function sortLevels(names) {
  return [...names].sort((a, b) => levelRank(a) - levelRank(b) || a.localeCompare(b));
}

// Lists the "folders" (common prefixes) directly under `prefix`, using R2's
// delimiter support the same way S3 does. Handles pagination via cursor.
export async function listPrefixes(bucket, prefix) {
  const prefixes = [];
  let cursor;
  do {
    const result = await bucket.list({ prefix, delimiter: "/", cursor });
    for (const p of result.delimitedPrefixes) prefixes.push(p);
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
  return prefixes;
}

// Lists objects directly under `prefix` (not in any deeper sub-folder,
// e.g. not under a nested thumbs/ folder), sorted by key. Handles pagination.
export async function listObjects(bucket, prefix) {
  const objects = [];
  let cursor;
  do {
    const result = await bucket.list({ prefix, delimiter: "/", cursor });
    for (const o of result.objects) objects.push(o);
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
  objects.sort((a, b) => a.key.localeCompare(b.key));
  return objects;
}

// "2026/" -> "2026"
export function lastSegment(prefix) {
  return prefix.replace(/\/$/, "").split("/").pop();
}

// "week-03_2026-09-11" -> { weekNum: "03", date: "2026-09-11" }
export function parseWeekFolder(folderName) {
  const match = folderName.match(/^week-(\d+)_(\d{4}-\d{2}-\d{2})$/);
  if (!match) return { weekNum: folderName, date: null };
  return { weekNum: match[1], date: match[2] };
}

// `customLabel` overrides the "Week N" title entirely, for weeks that aren't
// a regular-season game against a single opponent (e.g. a preseason
// scrimmage) — set via a `label` field on the SCHEDULE entry.
export function formatWeekLabel(weekNum, date, customLabel) {
  const num = parseInt(weekNum, 10);
  const label = customLabel || (Number.isNaN(num) ? `Week ${weekNum}` : `Week ${num}`);
  if (!date) return label;
  const d = new Date(`${date}T12:00:00`);
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${label} (${dateLabel})`;
}

// Optional one-line caption for a week, stored as a plain text object at
// the week folder's root (not inside any level folder). Returns null if
// no caption has been set, so callers can treat it as "nothing to show".
export async function getCaption(bucket, weekPrefix) {
  const obj = await bucket.get(`${weekPrefix}caption.txt`);
  if (!obj) return null;
  const text = (await obj.text()).trim();
  return text || null;
}

// Finds every named photo group directly under a week (e.g. "varsity",
// "instagram"), in display order — whatever's actually there, rather than
// assuming LEVELS.
export async function findWeekLevels(bucket, weekPrefix) {
  const prefixes = await listPrefixes(bucket, weekPrefix);
  return sortLevels(prefixes.map(lastSegment));
}

// Finds the real R2 week folder for a given year + week number (e.g. "01"),
// regardless of the date baked into the folder name. Returns
// { folderName, weekPrefix, date } or null if no such folder exists yet.
export async function findWeekFolder(bucket, year, weekNum) {
  const weekPrefixes = await listPrefixes(bucket, `${year}/`);
  for (const weekPrefix of weekPrefixes) {
    const folderName = lastSegment(weekPrefix);
    const parsed = parseWeekFolder(folderName);
    if (parsed.weekNum === weekNum) {
      return { folderName, weekPrefix, date: parsed.date };
    }
  }
  return null;
}

export function publicUrl(key) {
  return `https://photos.rolljags.com/${key.split("/").map(encodeURIComponent).join("/")}`;
}
