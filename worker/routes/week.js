import { LEVELS, levelLabel, listObjects, findWeekFolder, formatWeekLabel, publicUrl } from "../lib/r2.js";
import { SCHEDULE } from "../lib/schedule.js";

export async function handleWeek(env, year, weekNum) {
  const found = await findWeekFolder(env.PHOTOS, year, weekNum);

  if (!found) {
    if ((SCHEDULE[year] || []).includes(weekNum)) {
      return Response.json({
        year,
        week: weekNum,
        label: formatWeekLabel(weekNum, null),
        status: "coming-soon",
        levels: [],
      });
    }
    return Response.json({ error: "Week not found" }, { status: 404 });
  }

  const levels = [];
  for (const level of LEVELS) {
    const levelPrefix = `${found.weekPrefix}${level}/`;
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

  return Response.json({
    year,
    week: weekNum,
    label: formatWeekLabel(weekNum, found.date),
    status: levels.length > 0 ? "live" : "coming-soon",
    levels,
  });
}
