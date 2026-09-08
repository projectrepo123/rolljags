// The site brands itself "Jaguar Football" in its visible chrome, but that
// alone matched every generic "jaguar" query in the world (jaguar football
// club, bay area jaguars) and drew impressions from the UK and Vietnam. Titles
// and descriptions say the full thing so search engines know which Jaguars
// this is and where they play.
const SITE_NAME = "Seckman Jaguars Football";
const TEAM_NAME = "Seckman Jaguars";
const SCHOOL_NAME = "Seckman High School";
const LOCALITY = "Imperial, MO";
const SITE_ORIGIN = "https://rolljags.com";
const FALLBACK_DESCRIPTION = `Game day photos for ${SCHOOL_NAME} Jaguars football in ${LOCALITY}. Browse by week and download full-resolution photos for free.`;

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// JSON-LD sits in the document as a data block, not an executed script, so the
// strict script-src in index.js never applies to it. It still has to be safe
// against a caption or opponent containing "</script>".
function jsonLd(payload) {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

// "Home vs. Oakville" reads as "vs. Oakville"; an away game reads "at
// Lindbergh". Returns "" when the week has no single opponent (a scrimmage or
// jamboree carries a label instead).
function opponentPhrase(opponent, homeAway) {
  if (!opponent) return "";
  return homeAway === "Away" ? `at ${opponent}` : `vs. ${opponent}`;
}

// The visible <h1> on a week page. gallery.js builds the same string client
// side (see weekHeading there) so the heading doesn't flicker when the photo
// list lands — keep the two in step.
export function weekHeading(label, opponent, homeAway) {
  const phrase = opponentPhrase(opponent, homeAway);
  return phrase ? `${SITE_NAME} ${phrase}, ${label}` : `${SITE_NAME}, ${label}`;
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

// `headingSelector`/`heading` server-render the page's <h1>. Without it a
// crawler sees the literal placeholder text the page ships with ("Loading…")
// as the topic heading of every gallery.
function injectMeta(assetResponse, title, metaHtml, headingSelector, heading) {
  let rewriter = new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .on("head", {
      element(el) {
        el.append(metaHtml, { html: true });
      },
    });

  if (headingSelector && heading) {
    rewriter = rewriter.on(headingSelector, {
      element(el) {
        el.setInnerContent(heading);
      },
    });
  }

  return rewriter.transform(assetResponse);
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
  let heading = null;
  let structured = "";

  if (data) {
    const phrase = opponentPhrase(data.opponent, data.homeAway);
    heading = weekHeading(data.label, data.opponent, data.homeAway);
    title = phrase
      ? `${data.label} ${phrase} | ${SITE_NAME}`
      : `${data.label} | ${SITE_NAME}`;

    if (data.status === "live") {
      description =
        data.caption ||
        `${data.label} photos of ${SCHOOL_NAME} Jaguars football in ${LOCALITY}. Browse and download the full set.`;
      image = data.cover || fallbackImage;

      const photoCount = data.levels.reduce((sum, lvl) => sum + lvl.photos.length, 0);
      structured = jsonLd({
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        name: heading,
        description,
        url: pageUrl,
        ...(image ? { thumbnailUrl: image } : {}),
        ...(photoCount ? { numberOfItems: photoCount } : {}),
        about: { "@type": "SportsTeam", "@id": `${SITE_ORIGIN}/#team`, name: TEAM_NAME },
      });
    } else {
      description = "Photos haven't been posted yet. Check back after the game.";
    }
  }

  return injectMeta(
    assetResponse,
    title,
    buildMeta(title, description, image, pageUrl) + structured,
    "#week-title",
    heading
  );
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
  let description = `Season records and game results for ${SCHOOL_NAME} Jaguars football in ${LOCALITY}, from 1999 to today.`;
  let heading = null;

  if (summary) {
    title = `${summary.year} ${SITE_NAME} Season (${summary.record}) | ${LOCALITY}`;
    description = `Game-by-game results for the ${summary.year} ${SCHOOL_NAME} Jaguars football season (${summary.record}) in ${LOCALITY}.`;
    heading = `${summary.year} ${SITE_NAME} Season`;
  }

  return injectMeta(
    assetResponse,
    title,
    buildMeta(title, description, fallbackImage, pageUrl),
    "#season-title",
    heading
  );
}

// The schedule page is the one that already earns impressions, so it gets the
// full SportsEvent treatment. The games come from SCHEDULE rather than being
// duplicated into schedule.html, so editing the season in one place keeps the
// structured data correct. Purely additive: it appends to <head> and removes
// nothing, so the page's own og tags still win where they overlap.
export function injectScheduleMeta(assetResponse, games, year, url) {
  const canonical = `${url.origin}/schedule`;

  const events = games
    // A SportsEvent needs two competitors. An intrasquad scrimmage or a
    // jamboree has a label instead of an opponent, and emitting it would put
    // Seckman on both sides of its own game. Same filter nextGame() applies.
    .filter((game) => game.date && game.opponent)
    .map((game) => {
      const phrase = opponentPhrase(game.opponent, game.homeAway);
      return {
        "@type": "SportsEvent",
        name: `${TEAM_NAME} ${phrase}`,
        startDate: game.kickoff || game.date,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        url: `${url.origin}/week?year=${year}&week=${game.week}`,
        sport: "American Football",
        homeTeam: {
          "@type": "SportsTeam",
          name: game.homeAway === "Away" ? game.opponent : TEAM_NAME,
        },
        awayTeam: {
          "@type": "SportsTeam",
          name: game.homeAway === "Away" ? TEAM_NAME : game.opponent,
        },
        ...(game.homeAway === "Home"
          ? {
              location: {
                "@type": "Place",
                name: SCHOOL_NAME,
                address: {
                  "@type": "PostalAddress",
                  addressLocality: "Imperial",
                  addressRegion: "MO",
                  addressCountry: "US",
                },
              },
            }
          : {}),
      };
    });

  const structured = jsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${year} ${SITE_NAME} Schedule`,
    url: canonical,
    itemListElement: events.map((event, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: event,
    })),
  });

  return new HTMLRewriter()
    .on("head", { element: (el) => el.append(structured, { html: true }) })
    .transform(assetResponse);
}
