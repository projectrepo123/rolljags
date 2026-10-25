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
export function opponentPhrase(opponent, homeAway) {
  if (!opponent) return "";
  return homeAway === "Away" ? `at ${opponent}` : `vs. ${opponent}`;
}

// The visible <h1> on a week page. gallery.js builds the same string client
// side (see weekHeading there) so the heading doesn't flicker when the photo
// list lands — keep the two in step.
// The week number and date sit in the eyebrow above it (see prefillWeek), so
// the heading itself stays short.
export function weekHeading(label, opponent, homeAway) {
  const phrase = opponentPhrase(opponent, homeAway);
  return phrase ? `${TEAM_NAME} ${phrase}` : `${TEAM_NAME}, ${labelWithoutDate(label)}`;
}

// "Week 8 (Oct 16)" -> "Week 8"
function labelWithoutDate(label) {
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

// "Week 8 (Oct 16)" -> "Oct 16"
function labelDate(label) {
  return label.match(/\(([^)]*)\)\s*$/)?.[1] || "";
}

// 1200x630, the size link previews are drawn at. Gallery photos vary in
// shape, so only this one states its dimensions.
const DEFAULT_SHARE_IMAGE = "/og-default.jpg";

function buildMeta(title, description, image, pageUrl) {
  const imageSize = image.endsWith(DEFAULT_SHARE_IMAGE)
    ? `
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">`
    : "";
  return `
    <link rel="canonical" href="${escapeAttr(pageUrl)}">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:image" content="${escapeAttr(image)}">${imageSize}
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
        // A heading object carries markup (the season page's kicker line);
        // a plain string is text and gets escaped.
        if (typeof heading === "string") el.setInnerContent(heading);
        else el.setInnerContent(heading.html, { html: true });
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
  const fallbackImage = `${url.origin}${DEFAULT_SHARE_IMAGE}`;

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
      const standard = `${data.label} photos of ${SCHOOL_NAME} Jaguars football in ${LOCALITY}. Browse and download the full set.`;
      // A caption alone is a few words ("Home vs. Fox, W 26-20"), too thin for
      // a search snippet, so the standard sentence follows it.
      description = data.caption ? `${data.caption.replace(/[.!]?\s*$/, ".")} ${standard}` : standard;
      image = data.shareImage || data.cover || fallbackImage;

      const photoCount = data.levels.reduce((sum, lvl) => sum + lvl.photos.length, 0);
      structured = jsonLd({
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        name: heading,
        description,
        url: pageUrl,
        ...(data.cover ? { thumbnailUrl: data.cover } : {}),
        ...(photoCount ? { numberOfItems: photoCount } : {}),
        about: { "@type": "SportsTeam", "@id": `${SITE_ORIGIN}/#team`, name: TEAM_NAME },
      });
    } else if (data.status === "no-photos") {
      description = "There are no photos from this game.";
    } else {
      description = "Photos haven't been posted yet. Check back after the game.";
    }
  }

  const withMeta = injectMeta(
    assetResponse,
    title,
    buildMeta(title, description, image, pageUrl) + structured,
    "#week-title",
    heading
  );
  return data ? prefillWeek(withMeta, data) : withMeta;
}

// Server-renders what gallery.js would otherwise add after the photo list
// loads, so nothing above the grid appears late and pushes it down. The
// caption rule matches gallery.js: skip it when it only repeats the title.
function prefillWeek(response, data) {
  const titleWithoutDate = labelWithoutDate(data.label);
  const hasScore = Boolean(data.result);
  // A caption that's just the score ("vs. Ritenour, W 26-0") repeats the
  // scoreboard, so it's dropped once there is one.
  const repeatsScore = hasScore && data.caption?.includes(`${data.pointsFor}-${data.pointsAgainst}`);
  const caption = data.caption && data.caption !== titleWithoutDate && !repeatsScore ? data.caption : "";
  const live = data.status === "live";

  const eyebrow = [data.opponent ? titleWithoutDate : null, labelDate(data.label), data.notes]
    .filter(Boolean)
    .join(" · ");

  // The first thumbnail is the page's largest paint, and gallery.js only adds
  // it after fetching the photo list, so start the download from the head.
  const firstThumb = live ? data.levels[0]?.photos[0]?.thumbUrl : null;

  return new HTMLRewriter()
    .on("head", {
      element: (el) => {
        if (firstThumb) el.append(`<link rel="preload" as="image" fetchpriority="high" href="${escapeAttr(firstThumb)}">`, { html: true });
      },
    })
    .on("#week-eyebrow", { element: (el) => el.setInnerContent(eyebrow) })
    .on("#scoreboard", {
      element: (el) => {
        if (!hasScore || !data.opponent) return;
        el.removeAttribute("hidden");
        el.setInnerContent(scoreboardHtml(data), { html: true });
      },
    })
    .on("#week-caption", { element: (el) => el.setInnerContent(caption) })
    .on("#week-more-coming", {
      element: (el) => {
        if (data.moreToCome) el.removeAttribute("hidden");
      },
    })
    .on("#level-tabs, #level-toolbar", {
      element: (el) => {
        if (live) el.setAttribute("class", `${el.getAttribute("class")} reserve`);
      },
    })
    .transform(response);
}

// Seckman always on the left; the winning side's number is picked out in gold.
function scoreboardHtml(data) {
  const ours = Number(data.pointsFor);
  const theirs = Number(data.pointsAgainst);
  const status = { W: "Win", L: "Loss", T: "Tie" }[data.result] || "";
  const opponentLogo = data.logo
    ? `<img class="sb-logo sb-logo-badge" src="${escapeAttr(data.logo)}" alt="" width="64" height="64">`
    : "";
  return `
      <div class="sb-team">
        <img class="sb-logo" src="/logo.webp" alt="" width="64" height="51">
        <span class="sb-name">Seckman</span>
      </div>
      <div class="sb-center">
        <span class="sb-status">${escapeAttr(status)}</span>
        <span class="sb-points">
          <span class="sb-score${ours > theirs ? " sb-lead" : ""}">${ours}</span>
          <span class="sb-dash" aria-hidden="true">–</span>
          <span class="sb-score${theirs > ours ? " sb-lead" : ""}">${theirs}</span>
        </span>
      </div>
      <div class="sb-team sb-team-them">
        ${opponentLogo}
        <span class="sb-name">${escapeAttr(data.opponent)}</span>
      </div>
    `;
}

// Same idea as injectWeekMeta, but for season.html: reflects the season's
// win/loss record so a shared season link shows a real preview. `summary`
// is the result of getSeasonSummary(), or null when the year is missing
// or not present in history.json.
export function injectSeasonMeta(assetResponse, summary, url) {
  const fallbackImage = `${url.origin}${DEFAULT_SHARE_IMAGE}`;

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
    heading = {
      html: `<span class="h1-kicker">${SITE_NAME}</span> ${escapeAttr(summary.year)} Season`,
    };
  }

  return injectMeta(
    assetResponse,
    title,
    buildMeta(title, description, fallbackImage, pageUrl),
    "#season-title",
    heading
  );
}

// A player page: "#12 Brody Kube" in the title and heading, so a search for a
// player's name finds his page with the team and town attached. `player` is
// a roster entry, or null when ?n= doesn't match anyone.
export function injectPlayerMeta(assetResponse, player, rosterYear, url) {
  const canonical = new URL(url.origin);
  canonical.pathname = "/player";
  const n = url.searchParams.get("n");
  if (n !== null) canonical.searchParams.set("n", n);

  let title = `Roster | ${SITE_NAME}`;
  let description = `The ${SCHOOL_NAME} Jaguars football roster in ${LOCALITY}.`;
  let heading = null;

  if (player) {
    title = `#${player.number} ${player.name}, ${player.pos} | ${SITE_NAME}`;
    description = `${player.name} wears #${player.number} for the ${rosterYear} ${SCHOOL_NAME} Jaguars football team in ${LOCALITY}: ${player.pos}, ${player.class}. Record book entries and career stats.`;
    heading = {
      html: `<span class="h1-kicker">#${escapeAttr(String(player.number))} · ${escapeAttr(player.pos)} · ${escapeAttr(player.class)}</span> ${escapeAttr(player.name)}`,
    };
  }

  return injectMeta(
    assetResponse,
    title,
    buildMeta(title, description, `${url.origin}${DEFAULT_SHARE_IMAGE}`, canonical.toString()),
    "#player-title",
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
