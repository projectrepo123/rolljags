import { listPrefixes, listObjects, lastSegment, parseWeekFolder, formatWeekLabel, findWeekLevels, publicUrl } from "../lib/r2.js";
import { SCHEDULE, scheduleCaption } from "../lib/schedule.js";

async function loadRealWeeks(env, year, yearPrefix) {
  const weekPrefixes = await listPrefixes(env.PHOTOS, yearPrefix);
  const weeks = new Map();

  for (const weekPrefix of weekPrefixes) {
    const folderName = lastSegment(weekPrefix);
    const { weekNum, date } = parseWeekFolder(folderName);

    let totalCount = 0;
    let cover = null;

    for (const level of await findWeekLevels(env.PHOTOS, weekPrefix)) {
      const levelPrefix = `${weekPrefix}${level}/`;
      const objects = await listObjects(env.PHOTOS, levelPrefix);
      totalCount += objects.length;
      if (objects.length > 0 && !cover) {
        const fileName = objects[0].key.split("/").pop();
        cover = publicUrl(`${levelPrefix}thumbs/${fileName}`);
      }
    }

    if (totalCount === 0) continue;

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

  for (const yearPrefix of yearPrefixes) {
    const year = lastSegment(yearPrefix);
    if (!/^\d{4}$/.test(year)) continue;
    years.set(year, await loadRealWeeks(env, year, yearPrefix));
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
