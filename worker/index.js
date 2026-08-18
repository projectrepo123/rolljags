import { handleWeeks } from "./routes/weeks.js";
import { handleWeek } from "./routes/week.js";
import { handleZip } from "./routes/zip.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] === "api") {
      try {
        // GET /api/weeks
        if (parts[1] === "weeks" && parts.length === 2) {
          return withCache(request, ctx, () => handleWeeks(env));
        }

        // GET /api/week/:year/:week
        if (parts[1] === "week" && parts.length === 4) {
          return handleWeek(env, parts[2], parts[3]);
        }

        // GET /api/zip/:year/:week/:level
        if (parts[1] === "zip" && parts.length === 5) {
          return handleZip(env, parts[2], parts[3], parts[4]);
        }
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};

async function withCache(request, ctx, handler) {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await handler();
  const cacheable = new Response(response.body, response);
  cacheable.headers.set("Cache-Control", "public, max-age=300");
  ctx.waitUntil(cache.put(request, cacheable.clone()));
  return cacheable;
}
