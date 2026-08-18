export const LEVELS = ["varsity", "jv", "freshman"];

const LEVEL_LABELS = {
  varsity: "Varsity",
  jv: "JV",
  freshman: "Freshman",
};

export function levelLabel(level) {
  return LEVEL_LABELS[level] || level;
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

export function formatWeekLabel(weekNum, date) {
  const num = parseInt(weekNum, 10);
  const label = Number.isNaN(num) ? `Week ${weekNum}` : `Week ${num}`;
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
