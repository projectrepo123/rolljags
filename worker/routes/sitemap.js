import { listPrefixes, lastSegment, parseWeekFolder } from "../lib/r2.js";

// The static pages, with how often they actually change.
const STATIC_PAGES = [
  ["/", "weekly", "1.0"],
  ["/schedule", "weekly", "0.8"],
  ["/history", "monthly", "0.8"],
  ["/records", "monthly", "0.8"],
  ["/podcast", "weekly", "0.8"],
];

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

// Every week folder in R2, as {year, weekNum, date}. These are the galleries —
// the site's actual content, and what the old hand-written sitemap left out
// entirely. Generating them here means uploading a week stays the whole
// publishing step, with no sitemap edit to remember.
async function uploadedWeeks(bucket) {
  const weeks = [];

  for (const yearPrefix of await listPrefixes(bucket, "")) {
    const year = lastSegment(yearPrefix);
    if (!/^\d{4}$/.test(year)) continue;

    for (const weekPrefix of await listPrefixes(bucket, yearPrefix)) {
      // parseWeekFolder echoes the folder name back with a null date when it
      // doesn't match the week-NN_YYYY-MM-DD shape, so test the date rather
      // than the object itself.
      const parsed = parseWeekFolder(lastSegment(weekPrefix));
      if (parsed.date) weeks.push({ year, ...parsed });
    }
  }

  return weeks;
}

// Every season with a results table behind it. These pages long predate the
// photo galleries (1999 onwards), so they can't be derived from R2 — only
// history.json knows about them. Read the same way getSeasonSummary does.
async function seasonYears(env, origin) {
  try {
    const res = await env.ASSETS.fetch(new Request(`${origin}/data/history.json`));
    if (!res.ok) return [];
    return Object.keys(await res.json()).filter((year) => /^\d{4}$/.test(year));
  } catch {
    return [];
  }
}

export async function handleSitemap(env, origin) {
  // Only weeks with photos actually in R2. A scheduled week that hasn't been
  // shot yet renders "Coming soon" and has nothing to index, and its game date
  // is in the future, which is not a legal <lastmod>.
  const weeks = await uploadedWeeks(env.PHOTOS);

  // Newest first, matching how the site itself orders them.
  weeks.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // A year gets a /season page if history.json has results for it, or if it's
  // a season we're currently shooting.
  const seasons = [...new Set([...(await seasonYears(env, origin)), ...weeks.map((w) => w.year)])]
    .sort()
    .reverse();

  // Guards against a folder dated ahead of today (a week uploaded early, or a
  // typo in a folder name) putting a future date on every static page.
  const today = new Date().toISOString().slice(0, 10);
  const newest = weeks.map((w) => w.date).find((date) => date <= today);

  const entries = [
    ...STATIC_PAGES.map(([path, changefreq, priority]) =>
      urlEntry({
        loc: `${origin}${path}`,
        lastmod: newest,
        changefreq,
        priority,
      })
    ),
    ...weeks.map((week) =>
      urlEntry({
        loc: `${origin}/week?year=${week.year}&week=${week.weekNum}`,
        lastmod: week.date,
        changefreq: "monthly",
        priority: "0.9",
      })
    ),
    ...seasons.map((year) =>
      urlEntry({
        loc: `${origin}/season?year=${year}`,
        changefreq: "yearly",
        priority: "0.5",
      })
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
