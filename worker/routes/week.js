import { LEVELS, levelLabel, listObjects, parseWeekFolder, formatWeekLabel, publicUrl } from "../lib/r2.js";

export async function handleWeek(env, year, week) {
  const { weekNum, date } = parseWeekFolder(week);
  const levels = [];

  for (const level of LEVELS) {
    const levelPrefix = `${year}/${week}/${level}/`;
    const objects = await listObjects(env.PHOTOS, levelPrefix);
    if (objects.length === 0) continue;

    const photos = objects.map((obj) => {
      const fileName = obj.key.split("/").pop();
      return {
        name: fileName,
        thumbUrl: publicUrl(`${levelPrefix}thumbs/${fileName}`),
        fullUrl: publicUrl(obj.key),
      };
    });

    levels.push({ level, label: levelLabel(level), photos });
  }

  if (levels.length === 0) {
    return Response.json({ error: "Week not found" }, { status: 404 });
  }

  return Response.json({
    year,
    week,
    label: formatWeekLabel(weekNum, date),
    levels,
  });
}
