import { LEVELS, listPrefixes, listObjects, lastSegment, parseWeekFolder, formatWeekLabel, publicUrl } from "../lib/r2.js";

export async function handleWeeks(env) {
  const yearPrefixes = await listPrefixes(env.PHOTOS, "");
  const years = [];

  for (const yearPrefix of yearPrefixes) {
    const year = lastSegment(yearPrefix);
    if (!/^\d{4}$/.test(year)) continue;

    const weekPrefixes = await listPrefixes(env.PHOTOS, yearPrefix);
    const weeks = [];

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
          const firstKey = objects[0].key;
          const fileName = firstKey.split("/").pop();
          cover = publicUrl(`${levelPrefix}thumbs/${fileName}`);
        }
      }

      if (totalCount === 0) continue;

      weeks.push({
        year,
        week: folderName,
        weekNum,
        date,
        label: formatWeekLabel(weekNum, date),
        photoCount: totalCount,
        cover,
      });
    }

    weeks.sort((a, b) => a.weekNum.localeCompare(b.weekNum, undefined, { numeric: true }));
    if (weeks.length > 0) years.push({ year, weeks });
  }

  years.sort((a, b) => b.year.localeCompare(a.year));

  return Response.json({ years });
}
