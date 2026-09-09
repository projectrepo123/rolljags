// Photo "likes". The counter's identity is the photo's own R2 key, namespaced
// under "like:" so the KV store stays legible if anything else ever lands in it.
const KEY_PREFIX = "like:";

// Week folders are always written zero-padded ("week-01_...", "week-90_..."),
// so a single-digit ?week=1 still has to look for "week-01_" when listing.
function weekListPrefix(year, week) {
  const padded = String(week).padStart(2, "0");
  return `${KEY_PREFIX}${year}/week-${padded}_`;
}

function countFrom(entry) {
  // The count is mirrored into each key's metadata so a whole week's totals
  // come back from one list() call instead of one get() per photo. Falling
  // back to the value read keeps entries written before that mirroring (or by
  // hand) from reading as zero.
  const meta = Number(entry?.metadata?.c);
  return Number.isFinite(meta) && meta >= 0 ? meta : 0;
}

export async function handleGetLikes(env, year, week) {
  const prefix = weekListPrefix(year, week);
  const counts = {};

  let cursor;
  do {
    const result = await env.PHOTO_LIKES.list({ prefix, cursor });
    for (const entry of result.keys) {
      const count = countFrom(entry);
      // A zero renders nothing on the client, so there's no reason to ship it.
      if (count > 0) counts[entry.name.slice(KEY_PREFIX.length)] = count;
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return Response.json(
    { counts },
    // Deliberately not routed through withCache(): that pins max-age=300, and
    // a like that takes five minutes to appear reads as a broken button.
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}

export async function handleLike(env, key) {
  const kvKey = KEY_PREFIX + key;

  // KV has no atomic increment, so this is a read-modify-write and two likes
  // landing in the same instant can collapse into one. Accepted: the count is
  // a bit of fun, not a tally anyone reconciles. See the note in likes.js on
  // why the client updates optimistically rather than trusting this response.
  const current = Number(await env.PHOTO_LIKES.get(kvKey));
  const count = (Number.isFinite(current) && current >= 0 ? current : 0) + 1;

  await env.PHOTO_LIKES.put(kvKey, String(count), { metadata: { c: count } });

  return Response.json({ key, count });
}
