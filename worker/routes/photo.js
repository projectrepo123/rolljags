import { isValidPhotoKey } from "../lib/validate.js";

// Streams one original photo from the same origin as the site. The Download
// button uses it on phones to hand the file to the share sheet (which can save
// to Photos): the browser can only read the bytes of a same-origin response,
// and photos.rolljags.com sends no CORS headers. Plain downloads still go
// straight to photos.rolljags.com.
//
// A Worker's response never goes through the zone's cache rules, so the edge
// cache is used directly: a hit is served from the colo without touching R2.
// Originals don't change once uploaded, so they keep for a week at the edge.
const EDGE_SECONDS = 7 * 24 * 60 * 60;
const BROWSER_SECONDS = 24 * 60 * 60;

export async function handlePhoto(env, key, request, ctx) {
  if (!isValidPhotoKey(key)) return Response.json({ error: "Invalid photo" }, { status: 400 });

  // Keyed on the photo alone, so stray query params can't split the cache.
  const cacheKey = new Request(`${new URL(request.url).origin}/api/photo?key=${encodeURIComponent(key)}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const object = await env.PHOTOS.get(key);
  if (!object) return Response.json({ error: "Not found" }, { status: 404 });

  const response = new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
      "Content-Length": String(object.size),
      ETag: object.httpEtag,
      "Cache-Control": `public, max-age=${BROWSER_SECONDS}, s-maxage=${EDGE_SECONDS}`,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
