import { handleWeeks } from "./routes/weeks.js";
import { handleWeek, getWeekData } from "./routes/week.js";
import { getSeasonSummary } from "./routes/season.js";
import { handleZip } from "./routes/zip.js";
import { handleSchedule, scheduleGames } from "./routes/schedule.js";
import { handleBanner } from "./routes/banner.js";
import { handlePhoto } from "./routes/photo.js";
import { handleSitemap } from "./routes/sitemap.js";
import { handleGetLikes, handleLike } from "./routes/likes.js";
import { injectWeekMeta, injectSeasonMeta, injectScheduleMeta, injectPlayerMeta, opponentPhrase } from "./lib/meta.js";
import { loadRoster, findPlayer, injectRoster } from "./lib/roster.js";
import { isValidYear, isValidWeekNum, isValidLevel, isValidPhotoKey } from "./lib/validate.js";
import { nextGame } from "./lib/schedule.js";
import { headerHtml, FOOTER_HTML } from "./lib/chrome.js";
import { loadHistory } from "./lib/history.js";

// The season /schedule shows when no ?year= is given. Matches DEFAULT_YEAR in
// public/js/schedule.js, so the structured data describes the season the page
// actually renders.
const DEFAULT_SCHEDULE_YEAR = "2026";

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
    return withSecurityHeaders(decorateHtml(response, new URL(request.url)));
  },
};

// Runs on every HTML page after caching, so cached pages still pick up the
// current header and kickoff. Fills in the shared header and footer (see
// lib/chrome.js), and stamps the next kickoff into the head so the nav
// countdown can run without each page fetching the schedule.
function decorateHtml(response, url) {
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  const header = headerHtml(url.pathname);
  let rewriter = new HTMLRewriter()
    .on("header.site-header", { element: (el) => el.setInnerContent(header, { html: true }) })
    .on("footer.site-footer", { element: (el) => el.setInnerContent(FOOTER_HTML, { html: true }) });

  const upcoming = nextGame();
  if (upcoming) {
    const { game, at } = upcoming;
    const meta =
      `<meta name="next-kickoff" content="${at.toISOString()}">` +
      `<meta name="next-opponent" content="${escapeAttr(opponentPhrase(game.opponent, game.homeAway))}">`;
    rewriter = rewriter.on("head", { element: (el) => el.append(meta, { html: true }) });
  }

  return rewriter.transform(response);
}

// The home hero photo is the page's largest paint, but home.js only learns
// which photo it is after fetching /api/weeks. A preload in the head lets the
// download start while the HTML is still arriving. srcset and sizes must
// match what renderHero in public/js/home.js sets, or the browser fetches
// the image twice.
async function preloadHomeHero(asset, url, env, ctx) {
  if (!asset.ok || !asset.headers.get("content-type")?.includes("text/html")) return asset;
  try {
    // Only from the edge cache: on a miss the week list means a full R2
    // listing, and the HTML shouldn't wait on that. Warm it for the next
    // visitor and send this page without the hint.
    const weeksRequest = new Request(`${url.origin}/api/weeks`);
    const cached = await caches.default.match(cacheKeyFor(weeksRequest, [], null));
    if (!cached) {
      ctx.waitUntil(withCache(weeksRequest, ctx, () => handleWeeks(env)).then((r) => r.body?.cancel()));
      return asset;
    }
    const data = await cached.json();
    // Same pick as isHeroWeek in home.js: a newer final with no photos yet
    // leads with a crest, and a crest needs no preload.
    const latest = (data.years || [])
      .map((y) => y.weeks.filter((w) => w.status === "live" || (w.status === "coming-soon" && w.result)).pop())
      .find(Boolean);
    if (latest?.status !== "live") return asset;
    // Must match the photo renderHero in home.js picks.
    const cover = latest?.heroCover || latest?.cover;
    if (!cover || cover.startsWith("/") || !cover.includes("/thumbs/")) return asset;

    const view = cover.replace("/thumbs/", "/view/");
    const link =
      `<link rel="preload" as="image" fetchpriority="high" href="${escapeAttr(view)}" ` +
      `imagesrcset="${[`${escapeAttr(cover)} 640w`, latest.heroMid && `${escapeAttr(latest.heroMid)} 1080w`, `${escapeAttr(view)} 1600w`].filter(Boolean).join(", ")}" ` +
      `imagesizes="(min-width: 700px) 1600px, 100vw">`;
    return new HTMLRewriter()
      .on("head", { element: (el) => el.append(link, { html: true }) })
      .transform(asset);
  } catch (err) {
    console.error(err);
    return asset;
  }
}

function escapeAttr(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

async function handle(request, env, ctx) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (parts[0] === "api") {
      // GET /api/weeks
      if (parts[1] === "weeks" && parts.length === 2) {
        return withCache(request, ctx, () => handleWeeks(env));
      }

      // GET /api/photo?key=<original photo key>
      if (parts[1] === "photo" && parts.length === 2) {
        return handlePhoto(env, url.searchParams.get("key"));
      }

      // GET /api/week/:year/:week
      if (parts[1] === "week" && parts.length === 4) {
        const [, , year, week] = parts;
        if (!isValidYear(year) || !isValidWeekNum(week)) {
          return Response.json({ error: "Invalid week" }, { status: 400 });
        }
        return withCache(request, ctx, () => handleWeek(env, year, week));
      }

      // GET /api/schedule/:year
      if (parts[1] === "schedule" && parts.length === 3) {
        const [, , year] = parts;
        if (!isValidYear(year)) {
          return Response.json({ error: "Invalid year" }, { status: 400 });
        }
        return handleSchedule(year);
      }

      // GET /api/history: history.json plus the season in progress
      if (parts[1] === "history" && parts.length === 2) {
        return withCache(request, ctx, async () => {
          const data = await loadHistory(env, url.origin);
          return data ? Response.json(data) : Response.json({ error: "History unavailable" }, { status: 502 });
        });
      }

      // GET /api/banner
      if (parts[1] === "banner" && parts.length === 2) {
        return withCache(request, ctx, () => handleBanner(env));
      }

      // GET /api/likes?year=&week=
      if (parts[1] === "likes" && parts.length === 2) {
        const year = url.searchParams.get("year");
        const week = url.searchParams.get("week");
        if (!isValidYear(year) || !isValidWeekNum(week)) {
          return Response.json({ error: "Invalid week" }, { status: 400 });
        }
        // Not wrapped in withCache() on purpose — see handleGetLikes.
        return handleGetLikes(env, year, week);
      }

      // POST /api/like  { key }   — like
      // DELETE /api/like  { key } — take it back
      if (parts[1] === "like" && parts.length === 2) {
        if (request.method !== "POST" && request.method !== "DELETE") {
          return Response.json({ error: "Method not allowed" }, { status: 405 });
        }

        // Rate limited the same way /api/zip is: localStorage stops the honest
        // double-tap, this stops someone who cleared it.
        const ip = request.headers.get("cf-connecting-ip") || "unknown";
        const { success } = await env.LIKE_RATE_LIMITER.limit({ key: ip });
        if (!success) {
          return Response.json({ error: "Too many likes. Try again in a minute." }, { status: 429 });
        }

        const body = await request.json().catch(() => null);
        if (!isValidPhotoKey(body?.key)) {
          return Response.json({ error: "Invalid photo" }, { status: 400 });
        }

        return handleLike(env, body.key, request.method === "POST" ? 1 : -1);
      }

      // GET /api/zip/:year/:week/:level
      if (parts[1] === "zip" && parts.length === 5) {
        const [, , year, week, level] = parts;
        if (!isValidYear(year) || !isValidWeekNum(week) || !isValidLevel(level)) {
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

      return validParams
        ? withCache(request, ctx, buildResponse, ["year"], "/season")
        : buildResponse();
    }

    if (url.pathname === "/schedule.html" || url.pathname === "/schedule") {
      // Same "fetch the canonical extensionless path" reasoning as /week above.
      // This branch only appends SportsEvent structured data; the page keeps
      // its own title and og tags, which sit earlier in <head> and win.
      const requested = url.searchParams.get("year");
      const year = requested && isValidYear(requested) ? requested : DEFAULT_SCHEDULE_YEAR;

      const buildResponse = async () => {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = "/schedule";
        const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
        try {
          return injectScheduleMeta(asset, scheduleGames(year), year, url);
        } catch (err) {
          // Structured data is an enhancement. Without this, a bug in the
          // graph builder would hit the outer catch below and turn the whole
          // schedule page into a JSON 500.
          console.error(err);
          return asset;
        }
      };

      return withCache(request, ctx, buildResponse, ["year"], "/schedule");
    }

    if (url.pathname === "/roster.html" || url.pathname === "/roster") {
      // Same "fetch the canonical extensionless path" reasoning as /week.
      const buildResponse = async () => {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = "/roster";
        const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
        return injectRoster(asset, await loadRoster(env, url.origin));
      };
      return withCache(request, ctx, buildResponse, [], "/roster");
    }

    if (url.pathname === "/player.html" || url.pathname === "/player") {
      const n = url.searchParams.get("n");
      const buildResponse = async () => {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = "/player";
        const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
        const roster = await loadRoster(env, url.origin);
        const player = findPlayer(roster, n);
        const response = injectPlayerMeta(asset, player, roster?.year, url);
        // No such player: still the page (it says so), but not a 200 for
        // search engines to index.
        return player ? response : new Response(response.body, { status: 404, headers: response.headers });
      };
      return findPlayer(await loadRoster(env, url.origin), n)
        ? withCache(request, ctx, buildResponse, ["n"], "/player")
        : buildResponse();
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return preloadHomeHero(await env.ASSETS.fetch(request), url, env, ctx);
    }

    if (url.pathname === "/sitemap.xml") {
      try {
        return await withCache(request, ctx, () => handleSitemap(env, url.origin));
      } catch (err) {
        // The outer catch would answer with a JSON 500, which Search Console
        // reports as a broken sitemap. Serve the committed static file instead,
        // so the worst case is a stale sitemap rather than none.
        console.error(err);
        return env.ASSETS.fetch(request);
      }
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
  // The record book fetches a JSON file per scope tab, so give the data the same
  // short window as the code that reads it.
  // No stale-while-revalidate: it let a returning browser run a day-old
  // script against freshly deployed HTML (e.g. a header button with no
  // handler yet) for a page view after every deploy.
  [/\.(css|js|json)$/i, "public, max-age=300"],
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

const EDGE_CACHE_CONTROL = "public, max-age=300";

async function withCache(request, ctx, handler, varyParams = [], canonicalPath = null) {
  const cache = caches.default;
  const key = cacheKeyFor(request, varyParams, canonicalPath);

  // A hit comes back with the zone's Browser Cache TTL (4h) in place of the
  // max-age it was stored with, which kept returning visitors on a stale home
  // page long after a score or upload. Restate it on the way out.
  const cached = await cache.match(key);
  if (cached) {
    const age = Date.now() - Number(cached.headers.get("X-Built-At") || 0);
    // Stale-while-revalidate, done here at the edge. The entry is stored for
    // STORE_SECONDS but is only "fresh" for 5 minutes; past that the
    // visitor still gets it immediately and a rebuild runs behind the
    // response, so nobody waits on the R2 listing. (Browsers never see this:
    // they are always told max-age=300, which is what bit us with browser-side
    // SWR.) Beyond MAX_STALE_MS the copy is too old to serve, so wait instead.
    if (age > FRESH_MS && age < MAX_STALE_MS) {
      ctx.waitUntil(refresh(cache, key, handler));
    }
    if (age < MAX_STALE_MS) {
      const hit = new Response(cached.body, cached);
      hit.headers.set("Cache-Control", EDGE_CACHE_CONTROL);
      hit.headers.delete("X-Built-At");
      return hit;
    }
  }

  const response = await handler();

  // Only cache successes. Caching a 404/500 for 5 minutes turns a transient
  // R2 blip into a sustained outage for everyone hitting the same URL.
  if (!response.ok) return response;

  const cacheable = new Response(response.body, response);
  cacheable.headers.set("Cache-Control", EDGE_CACHE_CONTROL);
  ctx.waitUntil(store(cache, key, cacheable.clone()));
  return cacheable;
}

const FRESH_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 60 * 60 * 1000;
const STORE_SECONDS = 2 * 60 * 60;

function store(cache, key, response) {
  const copy = new Response(response.body, response);
  copy.headers.set("Cache-Control", `public, max-age=${STORE_SECONDS}`);
  copy.headers.set("X-Built-At", String(Date.now()));
  return cache.put(key, copy);
}

async function refresh(cache, key, handler) {
  try {
    const response = await handler();
    if (response.ok) await store(cache, key, response);
  } catch (err) {
    console.error("cache refresh failed", err);
  }
}
