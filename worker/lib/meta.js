const SITE_NAME = "Jaguar Football";
const FALLBACK_DESCRIPTION = "Season photos for Jaguar Football. Browse by week and download full-resolution photos.";

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function buildMeta(title, description, image, pageUrl) {
  return `
    <link rel="canonical" href="${escapeAttr(pageUrl)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:image" content="${escapeAttr(image)}">
    <meta property="og:url" content="${escapeAttr(pageUrl)}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="description" content="${escapeAttr(description)}">
  `;
}

function injectMeta(assetResponse, title, metaHtml) {
  return new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .on("head", {
      element(el) {
        el.append(metaHtml, { html: true });
      },
    })
    .transform(assetResponse);
}

// Rewrites the <head> of the week.html asset response with OG/Twitter tags
// reflecting the actual week (real photos, coming-soon, or a generic
// fallback), so links shared in group chats show a real preview instead of
// a blank one. `data` is the result of getWeekData(), or null when the
// query params are missing or don't resolve to a known week.
export function injectWeekMeta(assetResponse, data, url) {
  const fallbackImage = `${url.origin}/logo.webp`;

  // Both "/week.html?..." and "/week?..." serve this page, and links shared
  // around usually pick up tracking params. Point canonical/og:url at one
  // normalized form so search engines don't treat them as separate pages.
  const canonical = new URL(url.origin);
  canonical.pathname = "/week";
  for (const name of ["year", "week"]) {
    const value = url.searchParams.get(name);
    if (value !== null) canonical.searchParams.set(name, value);
  }
  const pageUrl = canonical.toString();

  let title = SITE_NAME;
  let description = FALLBACK_DESCRIPTION;
  let image = fallbackImage;

  if (data && data.status === "live") {
    title = `${data.label} | ${SITE_NAME}`;
    description = data.caption || `${data.label} photos from ${SITE_NAME}. Browse and download the full set.`;
    image = data.cover || fallbackImage;
  } else if (data && data.status === "coming-soon") {
    title = `${data.label} | ${SITE_NAME}`;
    description = "Photos haven't been posted yet. Check back after the game.";
  }

  return injectMeta(assetResponse, title, buildMeta(title, description, image, pageUrl));
}

// Same idea as injectWeekMeta, but for season.html: reflects the season's
// win/loss record so a shared season link shows a real preview. `summary`
// is the result of getSeasonSummary(), or null when the year is missing
// or not present in history.json.
export function injectSeasonMeta(assetResponse, summary, url) {
  const fallbackImage = `${url.origin}/logo.webp`;

  // Same normalization as injectWeekMeta: strip tracking params so shared
  // links with different query junk all canonicalize to one URL per year.
  const canonical = new URL(url.origin);
  canonical.pathname = "/season";
  const year = url.searchParams.get("year");
  if (year !== null) canonical.searchParams.set("year", year);
  const pageUrl = canonical.toString();

  let title = `Team History | ${SITE_NAME}`;
  let description = "Jaguar Football season records and game results from 2004 to present.";

  if (summary) {
    title = `${summary.year} Season (${summary.record}) | ${SITE_NAME}`;
    description = `Game-by-game results for the ${summary.year} Jaguar Football season (${summary.record}).`;
  }

  return injectMeta(assetResponse, title, buildMeta(title, description, fallbackImage, pageUrl));
}
