import { listObjects, publicUrl } from "../lib/r2.js";

const BANNER_PREFIX = "site/schedule-banner/";

export async function handleBanner(env) {
  const objects = await listObjects(env.PHOTOS, BANNER_PREFIX);
  return Response.json({ images: objects.map((o) => publicUrl(o.key)) });
}
