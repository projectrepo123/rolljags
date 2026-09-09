import { listPrefixes, listObjects, lastSegment, parseWeekFolder, formatWeekLabel, findWeekLevels, publicUrl } from "../lib/r2.js";
import { SCHEDULE, scheduleCaption } from "../lib/schedule.js";
import { todayKey, pickDaily } from "../lib/daily.js";

async function loadRealWeeks(env, year, yearPrefix, day) {
  const weekPrefixes = await listPrefixes(env.PHOTOS, yearPrefix);
  const weeks = new Map();

  for (const weekPrefix of weekPrefixes) {
    const folderName = lastSegment(weekPrefix);
    const { weekNum, date } = parseWeekFolder(folderName);

    let totalCount = 0;
    // Every photo in the week, across all its groups, as a cover candidate.
    // This used to keep only the first object of the first non-empty group,
    // which froze each week's card on one shot for the rest of the season.
    // Collecting the rest costs nothing: these listings are already being
    // fetched to total the photo count.
    const candidates = [];

    for (const level of await findWeekLevels(env.PHOTOS, weekPrefix)) {
      const levelPrefix = `${weekPrefix}${level}/`;
      const objects = await listObjects(env.PHOTOS, levelPrefix);
      totalCount += objects.length;
      for (const obj of objects) {
        const fileName = obj.key.split("/").pop();
        // upload-week.mjs writes a thumbs/ sibling for every file it uploads,
        // so any photo here is usable as a cover.
        candidates.push(publicUrl(`${levelPrefix}thumbs/${fileName}`));
      }
    }

    if (totalCount === 0) continue;

    // One photo per week per day. listObjects sorts by key and findWeekLevels
    // returns a fixed order, so `candidates` is identical on every request —
    // which is what makes the seeded index stable rather than random.
    const cover = pickDaily(candidates, `${year}/${weekNum}/${day}`);

    const scheduledGame = (SCHEDULE[year.toString()] || []).find(g => g.week === weekNum);
    weeks.set(weekNum, {
      year,
      week: weekNum,
      weekNum,
      date,
      label: formatWeekLabel(weekNum, date, scheduledGame?.label),
      photoCount: totalCount,
      cover,
      status: "live",
      opponent: scheduledGame?.opponent,
      homeAway: scheduledGame?.homeAway,
      ...(scheduledGame?.moreToCome ? { moreToCome: true } : {}),
    });
  }

  return weeks;
}

// Weeks are chronological events, so order them by date rather than by week
// number. The number is an ID and a label source ("Week 3"), not a sort key —
// preseason entries like a scrimmage or a jamboree fall between numbered weeks
// with no integer available to express that (see the 90-99 range in
// lib/schedule.js). A week whose folder name didn't parse has no date, so fall
// back to the number for those rather than dropping them somewhere arbitrary.
function compareWeeks(a, b) {
  if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return a.weekNum.localeCompare(b.weekNum, undefined, { numeric: true });
}

export async function handleWeeks(env) {
  const yearPrefixes = await listPrefixes(env.PHOTOS, "");
  const years = new Map();

  // Read once for the whole response, so a request that happens to straddle
  // local midnight can't seed some weeks off yesterday and the rest off today.
  const day = todayKey();

  for (const yearPrefix of yearPrefixes) {
    const year = lastSegment(yearPrefix);
    if (!/^\d{4}$/.test(year)) continue;
    years.set(year, await loadRealWeeks(env, year, yearPrefix, day));
  }

  for (const [year, games] of Object.entries(SCHEDULE)) {
    if (!years.has(year)) years.set(year, new Map());
    const weeks = years.get(year);
    for (const game of games) {
      if (weeks.has(game.week)) continue;
      weeks.set(game.week, {
        year,
        week: game.week,
        weekNum: game.week,
        date: game.date,
        label: formatWeekLabel(game.week, game.date, game.label),
        caption: scheduleCaption(game),
        photoCount: 0,
        cover: game.cover || null,
        status: "coming-soon",
        opponent: game.opponent,
        homeAway: game.homeAway,
      });
    }
  }

  const result = [...years.entries()]
    .map(([year, weeks]) => ({
      year,
      weeks: [...weeks.values()].sort(compareWeeks),
    }))
    .filter((yearGroup) => yearGroup.weeks.length > 0)
    .sort((a, b) => b.year.localeCompare(a.year));

  return Response.json({ years: result });
}
