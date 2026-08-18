import { LEVELS, listPrefixes, listObjects, lastSegment, parseWeekFolder, formatWeekLabel, publicUrl } from "../lib/r2.js";
import { SCHEDULE, scheduleCaption } from "../lib/schedule.js";

async function loadRealWeeks(env, year, yearPrefix) {
  const weekPrefixes = await listPrefixes(env.PHOTOS, yearPrefix);
  const weeks = new Map();

  for (const weekPrefix of weekPrefixes) {
    const folderName = lastSegment(weekPrefix);
    const { weekNum, date } = parseWeekFolder(folderName);

    let totalCount = 0;
    let cover = null;

    for (const level of LEVELS) {
      const levelPrefix = `${weekPrefix}${level}/`;
      const objects = await listObjects(env.PHOTOS, levelPrefix);
      totalCount += objects.length;
      if (objects.length > 0 && !cover) {
        const fileName = objects[0].key.split("/").pop();
        cover = publicUrl(`${levelPrefix}thumbs/${fileName}`);
      }
    }

    if (totalCount === 0) continue;

    weeks.set(weekNum, {
      year,
      week: weekNum,
      weekNum,
      date,
      label: formatWeekLabel(weekNum, date),
      photoCount: totalCount,
      cover,
      status: "live",
    });
  }

  return weeks;
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
        label: formatWeekLabel(game.week, game.date),
        caption: scheduleCaption(game),
        photoCount: 0,
        cover: null,
        status: "coming-soon",
      });
    }
  }

  const result = [...years.entries()]
    .map(([year, weeks]) => ({
      year,
      weeks: [...weeks.values()].sort((a, b) =>
        a.weekNum.localeCompare(b.weekNum, undefined, { numeric: true })
      ),
    }))
    .filter((yearGroup) => yearGroup.weeks.length > 0)
    .sort((a, b) => b.year.localeCompare(a.year));

  return Response.json({ years: result });
}
