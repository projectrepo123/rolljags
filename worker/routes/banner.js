import { listObjects, publicUrl } from "../lib/r2.js";

const BANNER_PREFIX = "site/schedule-banner/";

export async function handleBanner(env) {
  const objects = await listObjects(env.PHOTOS, BANNER_PREFIX);
  // `images` stays the full-size list for anything that still reads it;
  // `thumbs` is the small tile for the same photo, same order (see
  // scripts/make-banner-thumbs.mjs).
  return Response.json({
    images: objects.map((o) => publicUrl(o.key)),
    thumbs: objects.map((o) => publicUrl(`${BANNER_PREFIX}thumbs/${o.key.split("/").pop().replace(/\.jpe?g$/i, ".webp")}`)),
  });
}
