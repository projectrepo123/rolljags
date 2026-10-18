import { initPhotoBanner } from "./banner.js";

const weeksEl = document.getElementById("weeks");
const heroEl = document.getElementById("home-hero");
const nextUpEl = document.getElementById("next-up");

function weekUrl(year, week) {
  // The extensionless form, matching the canonical the Worker injects and the
  // links on /schedule. Both paths serve the same page; using one keeps the
  // alias out of the crawl graph.
  return `/week?year=${encodeURIComponent(year)}&week=${encodeURIComponent(week)}`;
}

// "Week 3 (Sep 11)" -> "Week 3"; "Blue & Gold Scrimmage (Aug 15)" -> "Blue & Gold Scrimmage"
function labelWithoutDate(label) {
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

// "Week 3 (Sep 11)" -> "Sep 11"
function labelDate(label) {
  return label.match(/\(([^)]*)\)\s*$/)?.[1] || "";
}

function opponentPhrase(week) {
  if (!week.opponent) return "";
  return `${week.homeAway === "Away" ? "at" : "vs."} ${week.opponent}`;
}

// The card's big line: the opponent when there is one, else the event's name.
function cardTitle(week) {
  return opponentPhrase(week) || labelWithoutDate(week.label);
}

// The small line above it: week number and date, or just the date for an
// event whose name is already the title.
function cardEyebrow(week) {
  return [week.opponent ? labelWithoutDate(week.label) : null, labelDate(week.label)].filter(Boolean).join(" · ");
}

function photoAlt(week) {
  return week.opponent
    ? `Seckman Jaguars football ${opponentPhrase(week)}, ${week.label}`
    : `Seckman Jaguars football, ${week.label}`;
}

function resultChip(week) {
  const chip = document.createElement("span");
  const kind = { W: "win", L: "loss", T: "tie" }[week.result] || "tie";
  chip.className = `result-chip ${kind}`;
  chip.textContent = `${week.result} ${week.pointsFor}-${week.pointsAgainst}`;
  return chip;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// An opponent crest sits on a white badge over a navy tile, so logos that
// arrive with their own white or black box still look like one set.
function logoTile(src, className) {
  const tile = el("div", className);
  const img = el("img", "logo-badge");
  img.src = src;
  img.alt = "";
  img.loading = "lazy";
  tile.appendChild(img);
  return tile;
}

// The newest week with photos: the photo itself, the final score over it, and
// a way into the gallery.
function renderHero(week) {
  heroEl.href = weekUrl(week.year, week.week);
  heroEl.setAttribute("aria-label", `Latest game: ${photoAlt(week)}, ${week.photoCount} photos`);

  if (week.cover && !week.cover.startsWith("/")) {
    const img = el("img", "home-hero-photo");
    img.src = week.cover.replace("/thumbs/", "/view/");
    img.srcset = `${week.cover} 640w, ${week.cover.replace("/thumbs/", "/view/")} 1600w`;
    img.sizes = "(min-width: 1100px) 1052px, 100vw";
    img.fetchPriority = "high";
    img.alt = "";
    heroEl.appendChild(img);
  }

  const body = el("div", "home-hero-body");
  const eyebrow = [week.result ? "Final" : "Latest photos", cardEyebrow(week), week.notes].filter(Boolean).join(" · ");
  body.appendChild(el("p", "home-hero-eyebrow", eyebrow));

  if (week.result && week.opponent) {
    const score = el("p", "home-hero-score");
    const ours = Number(week.pointsFor);
    const theirs = Number(week.pointsAgainst);
    score.append(
      el("span", "", "Seckman "),
      el("span", `home-hero-points${ours > theirs ? " lead" : ""}`, String(ours)),
      el("span", "home-hero-sep", " · "),
      el("span", "", `${week.opponent} `),
      el("span", `home-hero-points${theirs > ours ? " lead" : ""}`, String(theirs))
    );
    body.appendChild(score);
  } else {
    body.appendChild(el("p", "home-hero-score", cardTitle(week)));
  }

  body.appendChild(el("span", "btn btn-gold", `See all ${week.photoCount} photos`));
  heroEl.appendChild(body);
  heroEl.classList.add("ready");
}

// The kickoff time the worker stamps into every page (see injectKickoff), so
// the strip can say "7:00 PM" without the schedule carrying times.
function kickoffTime(week) {
  const content = document.querySelector('meta[name="next-kickoff"]')?.content;
  if (!content) return "";
  const at = new Date(content);
  if (Number.isNaN(at.getTime())) return "";
  const sameDay = at.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) === week.date;
  return sameDay ? at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "";
}

function renderNextUp(week) {
  nextUpEl.setAttribute("aria-label", `Next game: ${cardTitle(week)}, ${labelDate(week.label)}`);
  if (week.cover && week.cover.startsWith("/")) nextUpEl.appendChild(logoTile(week.cover, "next-up-logo"));

  const text = el("div", "next-up-text");
  text.appendChild(el("span", "next-up-label", "Next up"));
  text.appendChild(el("span", "next-up-title", cardTitle(week)));
  const date = new Date(`${week.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  text.appendChild(el("span", "next-up-when", [date, kickoffTime(week), week.notes].filter(Boolean).join(" · ")));
  nextUpEl.appendChild(text);
  nextUpEl.appendChild(el("span", "next-up-cta", "Schedule →"));
  nextUpEl.classList.add("ready");
}

function renderCard(week, i) {
  const card = el("a", "week-card");
  card.href = weekUrl(week.year, week.week);
  // Drives the staggered entrance; capped so a long list doesn't leave the
  // last cards waiting noticeably.
  card.style.setProperty("--enter-delay", `${Math.min(i, 7) * 60}ms`);

  if (week.cover && week.cover.startsWith("/")) {
    card.appendChild(logoTile(week.cover, "cover cover-logo-tile"));
  } else if (week.cover) {
    const img = el("img", "cover");
    img.loading = "lazy";
    // Names the team and opponent rather than just "Week 2 (Sep 4)", so the
    // cover shots mean something in image search.
    img.alt = photoAlt(week);
    img.src = week.cover;
    card.appendChild(img);
  } else {
    card.appendChild(el("div", "cover"));
  }

  const body = el("div", "card-body");
  body.appendChild(el("p", "card-eyebrow", cardEyebrow(week)));
  body.appendChild(el("p", "card-title", cardTitle(week)));

  if (week.status === "no-photos") {
    const meta = el("div", "card-meta");
    if (week.result) meta.appendChild(resultChip(week));
    meta.appendChild(el("span", "badge-coming-soon badge-no-photos", "No photos"));
    body.appendChild(meta);
  } else {
    const meta = el("div", "card-meta");
    if (week.result) meta.appendChild(resultChip(week));
    meta.appendChild(el("p", "card-count", `${week.photoCount} photo${week.photoCount === 1 ? "" : "s"}`));

    if (week.moreToCome) {
      const badges = el("div", "card-badges");
      badges.appendChild(el("span", "badge-more-coming", "More coming"));
      meta.appendChild(badges);
    }
    body.appendChild(meta);
  }

  card.appendChild(body);
  return card;
}

// Played weeks, newest first. Upcoming games live in the "Next up" strip
// instead of the grid.
function renderYear(yearGroup) {
  const section = el("section", "year-section");
  section.appendChild(el("h2", "", `${yearGroup.year} Season`));

  const grid = el("div", "week-grid");
  const played = yearGroup.weeks.filter((w) => w.status !== "coming-soon").reverse();
  played.forEach((week, i) => grid.appendChild(renderCard(week, i)));

  section.appendChild(grid);
  return section;
}

async function init() {
  try {
    const res = await fetch("/api/weeks");
    const data = await res.json();

    weeksEl.innerHTML = "";

    if (!data.years || data.years.length === 0) {
      heroEl.remove();
      nextUpEl.remove();
      weeksEl.innerHTML = '<p class="empty-state">No photos yet. Check back after the next game.</p>';
      return;
    }

    // Years arrive newest-first, and each year's weeks in date order.
    const allWeeks = data.years.flatMap((y) => y.weeks);
    const latest = data.years
      .map((y) => y.weeks.filter((w) => w.status === "live").pop())
      .find(Boolean);
    const nextUp = data.years[0].weeks.find((w) => w.status === "coming-soon");

    if (latest) renderHero(latest);
    else heroEl.remove();

    if (nextUp) renderNextUp(nextUp);
    else nextUpEl.remove();

    for (const yearGroup of data.years) {
      if (yearGroup.weeks.some((w) => w.status !== "coming-soon")) weeksEl.appendChild(renderYear(yearGroup));
    }

    if (!allWeeks.some((w) => w.status !== "coming-soon")) {
      weeksEl.innerHTML = '<p class="empty-state">No photos yet. Check back after the next game.</p>';
    }
  } catch (err) {
    heroEl.remove();
    nextUpEl.remove();
    weeksEl.innerHTML = '<p class="empty-state">Couldn\'t load photos right now. Try refreshing.</p>';
  }
}

init();

// Deferred until the page's own resources (including the hero photo, the LCP
// candidate) have finished loading, so the archive strip's image requests
// don't compete with them on the same photos.rolljags.com origin.
window.addEventListener("load", () => initPhotoBanner());
