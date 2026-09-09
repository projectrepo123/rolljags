import { levelLabel, levelNote, listObjects, findWeekFolder, findWeekLevels, formatWeekLabel, publicUrl, getCaption } from "../lib/r2.js";
import { findScheduledGame, scheduleCaption } from "../lib/schedule.js";

// Looks up a week's data. Returns null if the week doesn't exist and isn't
// scheduled either (a true "not found" case for the caller to handle).
export async function getWeekData(env, year, weekNum) {
  const found = await findWeekFolder(env.PHOTOS, year, weekNum);
  const scheduledGame = findScheduledGame(year, weekNum);

  if (!found) {
    if (scheduledGame) {
      return {
        year,
        week: weekNum,
        label: formatWeekLabel(weekNum, scheduledGame.date, scheduledGame.label),
        status: "coming-soon",
        levels: [],
        caption: scheduleCaption(scheduledGame),
        date: scheduledGame.date,
        ...(scheduledGame.opponent ? { opponent: scheduledGame.opponent } : {}),
        ...(scheduledGame.homeAway ? { homeAway: scheduledGame.homeAway } : {}),
      };
    }
    return null;
  }

  const levels = [];
  for (const level of await findWeekLevels(env.PHOTOS, found.weekPrefix)) {
    const levelPrefix = `${found.weekPrefix}${level}/`;
    const objects = await listObjects(env.PHOTOS, levelPrefix);
    if (objects.length === 0) continue;

    const photos = objects.map((obj) => {
      const fileName = obj.key.split("/").pop();
      return {
        name: fileName,
        // The object key doubles as the photo's like-counter ID. Exposed here
        // so the client doesn't have to reassemble it out of the public URL.
        key: obj.key,
        thumbUrl: publicUrl(`${levelPrefix}thumbs/${fileName}`),
        // Resized for on-screen display; the original stays behind Download.
        viewUrl: publicUrl(`${levelPrefix}view/${fileName}`),
        fullUrl: publicUrl(obj.key),
      };
    });

    const note = levelNote(level);
    levels.push({ level, label: levelLabel(level), photos, ...(note ? { note } : {}) });
  }

  const realCaption = await getCaption(env.PHOTOS, found.weekPrefix);
  const caption = realCaption || (scheduledGame ? scheduleCaption(scheduledGame) : null);
  const cover = levels[0]?.photos[0]?.thumbUrl || null;

  return {
    year,
    week: weekNum,
    label: formatWeekLabel(weekNum, found.date, scheduledGame?.label),
    status: levels.length > 0 ? "live" : "coming-soon",
    levels,
    cover,
    // The opponent drives photo alt text and the page heading. /api/weeks has
    // exposed these all along; this endpoint was the odd one out, which left
    // the client parsing them back out of the caption string.
    date: found.date,
    ...(scheduledGame?.opponent ? { opponent: scheduledGame.opponent } : {}),
    ...(scheduledGame?.homeAway ? { homeAway: scheduledGame.homeAway } : {}),
    ...(caption ? { caption } : {}),
    ...(scheduledGame?.moreToCome ? { moreToCome: true } : {}),
  };
}

export async function handleWeek(env, year, weekNum) {
  const data = await getWeekData(env, year, weekNum);
  if (!data) return Response.json({ error: "Week not found" }, { status: 404 });
  return Response.json(data);
}
