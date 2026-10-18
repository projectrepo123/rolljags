import { isValidPhotoKey } from "../lib/validate.js";

// Streams one original photo from the same origin as the site. The Download
// button uses it on phones to hand the file to the share sheet (which can save
// to Photos): the browser can only read the bytes of a same-origin response,
// and photos.rolljags.com sends no CORS headers. Plain downloads still go
// straight to photos.rolljags.com.
export async function handlePhoto(env, key) {
  if (!isValidPhotoKey(key)) return Response.json({ error: "Invalid photo" }, { status: 400 });

  const object = await env.PHOTOS.get(key);
  if (!object) return Response.json({ error: "Not found" }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
      "Content-Length": String(object.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
