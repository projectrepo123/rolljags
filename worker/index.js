import { handleWeeks } from "./routes/weeks.js";
import { handleWeek, getWeekData } from "./routes/week.js";
import { getSeasonSummary } from "./routes/season.js";
import { handleZip } from "./routes/zip.js";
import { injectWeekMeta, injectSeasonMeta } from "./lib/meta.js";
import { isValidYear, isValidWeekNum } from "./lib/validate.js";
import { LEVELS } from "./lib/r2.js";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' https://photos.rolljags.com",
    "style-src 'self'",
    "script-src 'self' https://static.cloudflareinsights.com",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; "),
};

export default {
  async fetch(request, env, ctx) {
    const response = await handle(request, env, ctx);
    return withSecurityHeaders(response);
  },
};

async function handle(request, env, ctx) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (parts[0] === "api") {
      // GET /api/weeks
      if (parts[1] === "weeks" && parts.length === 2) {
        return withCache(request, ctx, () => handleWeeks(env));
      }

      // GET /api/week/:year/:week
      if (parts[1] === "week" && parts.length === 4) {
        const [, , year, week] = parts;
        if (!isValidYear(year) || !isValidWeekNum(week)) {
          return Response.json({ error: "Invalid week" }, { status: 400 });
        }
        return withCache(request, ctx, () => handleWeek(env, year, week));
      }

      // GET /api/zip/:year/:week/:level
      if (parts[1] === "zip" && parts.length === 5) {
        const [, , year, week, level] = parts;
        if (!isValidYear(year) || !isValidWeekNum(week) || !LEVELS.includes(level)) {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const ip = request.headers.get("cf-connecting-ip") || "unknown";
        const { success } = await env.ZIP_RATE_LIMITER.limit({ key: ip });
        if (!success) {
          return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
        }

        return handleZip(env, year, week, level);
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (url.pathname === "/week.html" || url.pathname === "/week") {
      // The assets binding 307-redirects "/week.html" -> "/week" (its
      // canonical extensionless URL) internally, even when called from
      // here, so fetch the canonical path directly to get real content
      // instead of a redirect response to rewrite.
      const year = url.searchParams.get("year");
      const week = url.searchParams.get("week");
      const validParams = year && week && isValidYear(year) && isValidWeekNum(week);

      const buildResponse = async () => {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = "/week";
        const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
        const data = validParams ? await getWeekData(env, year, week) : null;
        return injectWeekMeta(asset, data, url);
      };

      return validParams ? withCache(request, ctx, buildResponse) : buildResponse();
    }

    if (url.pathname === "/season.html" || url.pathname === "/season") {
      // Same rationale as the /week.html case above: fetch the canonical
      // extensionless path directly rather than following the redirect.
      const year = url.searchParams.get("year");
      const validParams = year && isValidYear(year);

      const buildResponse = async () => {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = "/season";
        const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
        const summary = validParams ? await getSeasonSummary(env, url.origin, year) : null;
        return injectSeasonMeta(asset, summary, url);
      };

      return validParams ? withCache(request, ctx, buildResponse) : buildResponse();
    }

    return env.ASSETS.fetch(request);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

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
