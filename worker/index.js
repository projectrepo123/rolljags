import { handleWeeks } from "./routes/weeks.js";
import { handleWeek, getWeekData } from "./routes/week.js";
import { handleZip } from "./routes/zip.js";
import { injectWeekMeta } from "./lib/meta.js";

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

    if (url.pathname === "/week.html" || url.pathname === "/week") {
      // The assets binding 307-redirects "/week.html" -> "/week" (its
      // canonical extensionless URL) internally, even when called from
      // here, so fetch the canonical path directly to get real content
      // instead of a redirect response to rewrite.
      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/week";
      const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
      const year = url.searchParams.get("year");
      const week = url.searchParams.get("week");
      const data = year && week ? await getWeekData(env, year, week) : null;
      return injectWeekMeta(asset, data, url);
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
