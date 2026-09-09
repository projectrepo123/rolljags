import { initPhotoBanner } from "./banner.js";

const weeksEl = document.getElementById("weeks");

function weekUrl(year, week) {
  // The extensionless form, matching the canonical the Worker injects and the
  // links on /schedule. Both paths serve the same page; using one keeps the
  // alias out of the crawl graph.
  return `/week?year=${encodeURIComponent(year)}&week=${encodeURIComponent(week)}`;
}

// The most recent week that actually has photos, so it can be flagged as the
// newest set. Years arrive newest-first from the API.
function findLatestWeek(years) {
  for (const yearGroup of years) {
    const live = yearGroup.weeks.filter((w) => w.status !== "coming-soon");
    if (live.length > 0) {
      const newest = live[live.length - 1];
      return `${newest.year}/${newest.week}`;
    }
  }
  return null;
}

function renderYear(yearGroup, latestKey) {
  const section = document.createElement("section");
  section.className = "year-section";

  const heading = document.createElement("h2");
  heading.textContent = `${yearGroup.year} Season`;
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "week-grid";

  // Weeks that actually have photos, plus the next game as a teaser. Future
  // weeks beyond that stay hidden so the grid doesn't fill with empty cards.
  const played = yearGroup.weeks.filter((w) => w.status !== "coming-soon");
  const nextUp = yearGroup.weeks.find((w) => w.status === "coming-soon");
  const visibleWeeks = nextUp ? [...played, nextUp] : played;

  visibleWeeks.forEach((week, i) => {
    const card = document.createElement("a");
    card.className = "week-card";
    card.href = weekUrl(week.year, week.week);
    // Drives the staggered entrance; capped so a long list doesn't leave the
    // last cards waiting noticeably.
    card.style.setProperty("--enter-delay", `${Math.min(i, 7) * 60}ms`);

    if (week.cover) {
      const img = document.createElement("img");
      // An upcoming week's cover is an opponent crest served from this site,
      // not a photo off photos.rolljags.com. Cropping a logo to fill a 4:3 box
      // slices it in half, so those get fitted instead — see .cover-logo.
      const isLogo = week.cover.startsWith("/");
      img.className = isLogo ? "cover cover-logo" : "cover";
      // The first cover is the largest thing above the fold, so let it load
      // right away instead of waiting on the lazy-loading pass.
      if (i === 0) {
        img.fetchPriority = "high";
      } else {
        img.loading = "lazy";
      }
      // Names the team and opponent rather than just "Week 2 (Sep 4)", so the
      // cover shots mean something in image search.
      img.alt = week.opponent
        ? `Seckman Jaguars football ${week.homeAway === "Away" ? "at" : "vs."} ${week.opponent}, ${week.label}`
        : `Seckman Jaguars football, ${week.label}`;
      img.src = week.cover;
      card.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "cover";
      card.appendChild(placeholder);
    }

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("p");
    title.className = "card-title";
    title.textContent = week.label;
    body.appendChild(title);

    if (week.opponent) {
      const opponent = document.createElement("p");
      opponent.className = "card-opponent";
      opponent.textContent = `${week.homeAway === "Home" ? "Home" : "Away"} vs. ${week.opponent}`;
      body.appendChild(opponent);
    }

    if (week.status === "coming-soon") {
      const badge = document.createElement("span");
      badge.className = "badge-coming-soon";
      badge.textContent = "Coming soon";
      body.appendChild(badge);
    } else {
      const meta = document.createElement("div");
      meta.className = "card-meta";

      const count = document.createElement("p");
      count.className = "card-count";
      count.textContent = `${week.photoCount} photo${week.photoCount === 1 ? "" : "s"}`;
      meta.appendChild(count);

      // Grouped so the row stays two-part — count on the left, badges together
      // on the right — however many badges a week ends up carrying.
      const badges = document.createElement("div");
      badges.className = "card-badges";

      if (week.moreToCome) {
        const badge = document.createElement("span");
        badge.className = "badge-more-coming";
        badge.textContent = "More coming";
        badges.appendChild(badge);
      }

      if (latestKey && `${week.year}/${week.week}` === latestKey) {
        const badge = document.createElement("span");
        badge.className = "badge-latest";
        badge.textContent = "Latest";
        badges.appendChild(badge);
      }

      meta.appendChild(badges);
      body.appendChild(meta);
    }

    card.appendChild(body);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

async function init() {
  try {
    const res = await fetch("/api/weeks");
    const data = await res.json();

    weeksEl.innerHTML = "";

    if (!data.years || data.years.length === 0) {
      weeksEl.innerHTML = '<p class="empty-state">No photos yet. Check back after the next game.</p>';
      return;
    }

    const latestKey = findLatestWeek(data.years);
    for (const yearGroup of data.years) {
      weeksEl.appendChild(renderYear(yearGroup, latestKey));
    }
  } catch (err) {
    weeksEl.innerHTML = '<p class="empty-state">Couldn\'t load photos right now. Try refreshing.</p>';
  }
}

init();

// Deferred until the page's own resources (including the week grid's cover
// photos, one of which is the LCP candidate) have finished loading, so the
// banner's own image requests don't compete with them for bandwidth on the
// same photos.rolljags.com origin and drag out LCP.
window.addEventListener("load", () => initPhotoBanner());
