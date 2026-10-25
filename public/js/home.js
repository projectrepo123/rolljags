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

// The large faint number behind a card. Only regular-season weeks have one:
// a scrimmage is week 0 and a jamboree sits in the 90s (see lib/schedule.js).
function weekNumber(week) {
  const n = parseInt(week.week, 10);
  return week.opponent && n >= 1 && n < 30 ? String(n) : "";
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
// "7-1" (or "7-1-1") from every game in that season with a result, whether or
// not it has photos.
function seasonRecord(weeks) {
  const count = (r) => weeks.filter((w) => w.result === r).length;
  const [w, l, t] = [count("W"), count("L"), count("T")];
  if (w + l + t === 0) return "";
  return t ? `${w}-${l}-${t}` : `${w}-${l}`;
}

function renderHero(week, record = "") {
  heroEl.href = weekUrl(week.year, week.week);
  heroEl.setAttribute("aria-label", `Latest game: ${photoAlt(week)}, ${week.photoCount} photos`);

  // heroCover is a different shot from the one on this week's card just
  // below, so the screen doesn't show the same photo twice. Must match
  // preloadHomeHero in worker/index.js.
  const photo = week.heroCover || week.cover;
  if (photo && !photo.startsWith("/")) {
    const img = el("img", "home-hero-photo");
    img.src = photo.replace("/thumbs/", "/view/");
    // The 1080w WebP sits between the two JPEGs when this week has one.
    const view = photo.replace("/thumbs/", "/view/");
    img.srcset = [`${photo} 640w`, week.heroMid && `${week.heroMid} 1080w`, `${view} 1600w`].filter(Boolean).join(", ");
    // Wide screens always get the 1600w original size: the 1080w WebP is soft
    // when stretched across a 1050px hero. Must match preloadHomeHero in
    // worker/index.js.
    img.sizes = "(min-width: 700px) 1600px, 100vw";
    img.fetchPriority = "high";
    img.alt = "";
    heroEl.appendChild(img);
  }

  heroEl.appendChild(el("span", "home-tag", "Latest"));
  const ghost = weekNumber(week);
  if (ghost) {
    const g = el("span", "home-hero-ghost", ghost);
    g.setAttribute("aria-hidden", "true");
    heroEl.appendChild(g);
  }

  const body = el("div", "home-hero-body");
  // Week, date and occasion. The "Latest" tag sits on the photo's corner.
  body.appendChild(el("p", "home-hero-eyebrow", [cardEyebrow(week), week.notes].filter(Boolean).join(" · ")));

  if (week.result && week.opponent) {
    const score = el("p", "home-hero-score");
    const ours = Number(week.pointsFor);
    const theirs = Number(week.pointsAgainst);
    // Each team is one unbreakable unit, so a narrow screen stacks them
    // "Seckman 26" over "Ritenour 0" rather than splitting a name from its score.
    const team = (name, points, lead) => {
      const span = el("span", "home-hero-team", `${name} `);
      span.appendChild(el("span", `home-hero-points${lead ? " lead" : ""}`, String(points)));
      return span;
    };
    score.append(
      team("Seckman", ours, ours > theirs),
      el("span", "home-hero-sep", " · "),
      team(week.opponent, theirs, theirs > ours)
    );
    body.appendChild(score);
  } else {
    body.appendChild(el("p", "home-hero-score", cardTitle(week)));
  }

  const actions = el("div", "home-hero-actions");
  actions.appendChild(el("span", "btn btn-gold", `See all ${week.photoCount} photos`));
  if (record) actions.appendChild(el("span", "home-hero-record", `${record} this season`));
  body.appendChild(actions);
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

// A card is the photo with the text over a bottom gradient: AT/VS above the
// opponent, a scoreboard score, then week, date and photo count. The anchor is
// wrapped in a cell so the lift and drop shadow can sit outside its cut corner.
function renderCard(week, i) {
  const cell = el("div", "week-cell");
  const kind = { W: "win", L: "loss", T: "tie" }[week.result] || "plain";
  const card = el("a", `week-card ${kind}`);
  card.href = weekUrl(week.year, week.week);
  // Drives the staggered entrance; capped so a long list doesn't leave the
  // last cards waiting noticeably.
  card.style.setProperty("--enter-delay", `${Math.min(i, 7) * 60}ms`);

  if (week.cover && week.cover.startsWith("/")) {
    card.appendChild(logoTile(week.cover, "wc-media cover-logo-tile"));
  } else if (week.cover) {
    const media = el("div", "wc-media");
    const img = el("img", "cover");
    img.loading = "lazy";
    // Names the team and opponent rather than just "Week 2 (Sep 4)", so the
    // cover shots mean something in image search.
    img.alt = photoAlt(week);
    img.width = 640;
    img.height = 427;
    img.src = week.cover;
    // 640w for normal screens, 1080w WebP (where this week has one) for
    // high-density ones, since the card crops the photo taller than it is wide.
    if (week.coverMid) {
      img.srcset = `${week.cover} 640w, ${week.coverMid} 1080w`;
      img.sizes = "(max-width: 560px) 100vw, 480px";
    }
    media.appendChild(img);
    card.appendChild(media);
  } else {
    card.appendChild(el("div", "wc-media"));
  }

  card.appendChild(el("div", "wc-shade"));
  const ghost = weekNumber(week);
  if (ghost) {
    const g = el("span", "wc-ghost", ghost);
    g.setAttribute("aria-hidden", "true");
    card.appendChild(g);
  }

  const info = el("div", "wc-info");
  if (week.opponent) info.appendChild(el("span", "wc-kick", week.homeAway === "Away" ? "At" : "Vs"));
  const title = el("h3", "wc-opp");
  title.appendChild(el("span", "", week.opponent || labelWithoutDate(week.label)));
  info.appendChild(title);

  if (week.result) {
    const score = el("div", "wc-score");
    score.setAttribute("aria-label", `${{ W: "Win", L: "Loss", T: "Tie" }[week.result] || week.result} ${week.pointsFor} to ${week.pointsAgainst}`);
    score.append(
      el("b", "us", String(week.pointsFor)),
      el("i", "dash"),
      el("b", "them", String(week.pointsAgainst)),
      el("span", "res", { W: "Win", L: "Loss", T: "Tie" }[week.result] || week.result)
    );
    info.appendChild(score);
  }

  const count = week.status === "no-photos" ? "No photos" : `${week.photoCount} photo${week.photoCount === 1 ? "" : "s"}`;
  // Two lines so a long occasion ("Senior Night", "Homecoming") never pushes
  // the photo count onto a line that starts with a stray dot.
  const meta = el("div", "wc-meta");
  meta.appendChild(el("span", "", [cardEyebrow(week), week.opponent ? week.notes : null].filter(Boolean).join(" · ")));
  meta.appendChild(el("span", "wc-count", [count, week.moreToCome ? "More coming" : null].filter(Boolean).join(" · ")));
  info.appendChild(meta);
  card.appendChild(info);

  cell.appendChild(card);
  return cell;
}

// Played weeks, newest first. Upcoming games live in the "Next up" strip
// instead of the grid.
// `skip` is the week already shown in the hero above, so the same game isn't
// on screen twice; the hero links to its gallery.
function renderYear(yearGroup, skip = null) {
  const section = el("section", "year-section");
  const heading = el("h2", "", `${yearGroup.year} Season`);
  const record = seasonRecord(yearGroup.weeks);
  if (record) heading.appendChild(el("span", "year-record", ` · ${record}`));
  section.appendChild(heading);

  const grid = el("div", "week-grid");
  const played = yearGroup.weeks.filter((w) => w.status !== "coming-soon" && w !== skip).reverse();
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
    // A game that's been played but has no photos or score yet is still
    // "coming soon", so skip anything dated before today. en-CA formats as
    // YYYY-MM-DD in the visitor's own timezone.
    const today = new Date().toLocaleDateString("en-CA");
    const nextUp = data.years[0].weeks.find((w) => w.status === "coming-soon" && w.date >= today);

    const latestYear = latest && data.years.find((y) => y.weeks.includes(latest));
    const heroShown = Boolean(latest);
    if (latest) renderHero(latest, seasonRecord(latestYear.weeks));
    else heroEl.remove();

    if (nextUp) renderNextUp(nextUp);
    else nextUpEl.remove();

    for (const yearGroup of data.years) {
      if (yearGroup.weeks.some((w) => w.status !== "coming-soon")) weeksEl.appendChild(renderYear(yearGroup, heroShown && yearGroup === latestYear ? latest : null));
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
