import { handleWeeks } from "./routes/weeks.js";
import { handleWeek, getWeekData } from "./routes/week.js";
import { handleZip } from "./routes/zip.js";
import { injectWeekMeta } from "./lib/meta.js";
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
    "frame-src https://www.youtube.com https://open.spotify.com",
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

      // "/week.html" and "/week" serve identical content, so cache them under
      // the one canonical path instead of duplicating every week's entry.
      return validParams
        ? withCache(request, ctx, buildResponse, ["year", "week"], "/week")
        : buildResponse();
    }

    return withAssetCache(url, await env.ASSETS.fetch(request));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// Static assets otherwise come back as "max-age=0, must-revalidate", which
// costs a round-trip per file on every page load. Filenames here are not
// content-hashed, so the CSS/JS window is deliberately short: long enough to
// cover a browsing session, short enough that a deploy still lands promptly.
const ASSET_CACHE_RULES = [
  [/\.(webp|avif|png|jpe?g|gif|svg|ico|woff2?)$/i, "public, max-age=604800"],
  [/\.(css|js)$/i, "public, max-age=600, stale-while-revalidate=86400"],
];

function withAssetCache(url, response) {
  if (!response.ok) return response;

  const rule = ASSET_CACHE_RULES.find(([pattern]) => pattern.test(url.pathname));
  if (!rule) return response;

  const cached = new Response(response.body, response);
  cached.headers.set("Cache-Control", rule[1]);
  return cached;
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

// Builds the edge cache key. Only the params a route actually varies on are
// kept, so "/api/weeks?utm_source=x" and "/api/weeks?cachebust=<random>" all
// collapse onto the same entry instead of each triggering a fresh (and
// expensive) fan-out of R2 list calls.
function cacheKeyFor(request, varyParams, canonicalPath) {
  const url = new URL(request.url);
  if (canonicalPath) url.pathname = canonicalPath;
  const kept = new URLSearchParams();
  for (const name of varyParams) {
    const value = url.searchParams.get(name);
    if (value !== null) kept.set(name, value);
  }
  url.search = kept.toString();
  return new Request(url.toString(), { method: "GET" });
}

async function withCache(request, ctx, handler, varyParams = [], canonicalPath = null) {
  const cache = caches.default;
  const key = cacheKeyFor(request, varyParams, canonicalPath);

  const cached = await cache.match(key);
  if (cached) return cached;

  const response = await handler();

  // Only cache successes. Caching a 404/500 for 5 minutes turns a transient
  // R2 blip into a sustained outage for everyone hitting the same URL.
  if (!response.ok) return response;

  const cacheable = new Response(response.body, response);
  cacheable.headers.set("Cache-Control", "public, max-age=300");
  ctx.waitUntil(cache.put(key, cacheable.clone()));
  return cacheable;
}
