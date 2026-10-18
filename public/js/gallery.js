import { openLightbox } from "./lightbox.js";
import { loadCounts } from "./likes.js";

const params = new URLSearchParams(location.search);
const year = params.get("year");
const week = params.get("week");

const titleEl = document.getElementById("week-title");
const tabsEl = document.getElementById("level-tabs");
const toolbarEl = document.getElementById("level-toolbar");
const gridEl = document.getElementById("photo-grid");
const statusEl = document.getElementById("week-status");

let levels = [];
let activeLevel = null;
// Held at module scope so the photo grid can describe what it's showing; the
// grid renders again on every tab switch, long after init() returns.
let weekInfo = { label: "", opponent: null, homeAway: null };

// "vs. Oakville" for a home game, "at Lindbergh" for an away one, "" for a
// scrimmage or jamboree that has a label instead of a single opponent.
function opponentPhrase(opponent, homeAway) {
  if (!opponent) return "";
  return homeAway === "Away" ? `at ${opponent}` : `vs. ${opponent}`;
}

// Must match weekHeading() in worker/lib/meta.js, which server-renders this
// same string into the <h1> — if they drift, the heading visibly changes once
// the photo list loads.
function weekHeading(label, opponent, homeAway) {
  const phrase = opponentPhrase(opponent, homeAway);
  return phrase
    ? `Seckman Jaguars ${phrase}`
    : `Seckman Jaguars, ${label.replace(/\s*\([^)]*\)\s*$/, "").trim()}`;
}

function photoAlt(index, total) {
  const phrase = opponentPhrase(weekInfo.opponent, weekInfo.homeAway);
  const subject = phrase
    ? `Seckman Jaguars football ${phrase}`
    : `Seckman Jaguars football, ${weekInfo.label}`;
  const where = phrase ? `, ${weekInfo.label}` : "";
  return `${subject}${where}, photo ${index + 1} of ${total}`;
}

function renderTabs() {
  tabsEl.innerHTML = "";

  for (const lvl of levels) {
    const btn = document.createElement("button");
    btn.className = "level-tab" + (lvl.level === activeLevel ? " active" : "");
    btn.textContent = `${lvl.label} (${lvl.photos.length})`;
    btn.addEventListener("click", () => {
      activeLevel = lvl.level;
      renderTabs();
      renderLevel();
    });
    tabsEl.appendChild(btn);
  }
}

// The (i) beside the photo count, for a group whose contents need explaining
// (see LEVEL_NOTES in worker/lib/r2.js). Hover alone would hide this on every
// phone, and a `title` attribute is unreadable on touch and unstyleable, so
// this is a real disclosure: tap or click toggles it, a pointer opens it on
// hover, and it opens on keyboard focus. All three drive the same `open`
// class so they can't disagree about whether it's showing.
function buildLevelNote(text) {
  const wrap = document.createElement("span");
  wrap.className = "info-wrap";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "info-btn";
  btn.textContent = "i";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", "About this tab");

  const pop = document.createElement("span");
  pop.className = "info-pop";
  pop.id = "level-note-pop";
  pop.setAttribute("role", "note");
  pop.textContent = text;
  btn.setAttribute("aria-controls", pop.id);

  const setOpen = (open) => {
    wrap.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
  };

  btn.addEventListener("click", () => setOpen(!wrap.classList.contains("open")));
  btn.addEventListener("focus", () => setOpen(true));
  btn.addEventListener("blur", () => setOpen(false));

  // Only wire hover where there's a real pointer. On touch, browsers emit a
  // synthetic mouseenter on tap, which would fight the click toggle.
  if (window.matchMedia("(hover: hover)").matches) {
    wrap.addEventListener("mouseenter", () => setOpen(true));
    wrap.addEventListener("mouseleave", () => setOpen(false));
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  // A tap anywhere else dismisses it, the way any popover should.
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) setOpen(false);
  });

  wrap.append(btn, pop);
  return wrap;
}

function renderLevel() {
  const lvl = levels.find((l) => l.level === activeLevel);
  if (!lvl) return;

  toolbarEl.innerHTML = "";

  // Count and its (i) travel together on the left, so the toolbar stays a
  // two-part row with the download button on the right.
  const countGroup = document.createElement("div");
  countGroup.className = "count-group";

  const count = document.createElement("span");
  count.className = "photo-count";
  count.textContent = `${lvl.photos.length} photo${lvl.photos.length === 1 ? "" : "s"}`;
  countGroup.appendChild(count);

  if (lvl.score) {
    const score = document.createElement("span");
    score.className = "level-score";
    score.textContent = `${lvl.score.result} ${lvl.score.pointsFor}-${lvl.score.pointsAgainst}`;
    countGroup.appendChild(score);
  }

  if (lvl.note) countGroup.appendChild(buildLevelNote(lvl.note));
  toolbarEl.appendChild(countGroup);

  const zipLink = document.createElement("a");
  zipLink.className = "btn btn-gold";
  zipLink.href = `/api/zip/${encodeURIComponent(year)}/${encodeURIComponent(week)}/${encodeURIComponent(lvl.level)}`;
  zipLink.textContent = "Download all (.zip)";
  toolbarEl.appendChild(zipLink);

  gridEl.innerHTML = "";
  lvl.photos.forEach((photo, i) => {
    const btn = document.createElement("button");

    const img = document.createElement("img");
    img.src = photo.thumbUrl;
    // 400w for the small desktop tiles, 640w for dense phone screens; the JPEG
    // above stays as the fallback for photos without WebP copies.
    if (photo.thumbSrcset) {
      img.srcset = photo.thumbSrcset;
      img.sizes = "(max-width: 480px) 50vw, 180px";
    }
    // The first rows are on screen at once, so lazy-loading them only delays
    // what people see first. The rest wait until they're scrolled near.
    if (i < 12) {
      if (i < 3) img.fetchPriority = "high";
    } else {
      img.loading = "lazy";
    }
    // Describes the photo rather than its position, so it means something in
    // image search. The button deliberately has no aria-label: a button with a
    // single image takes its accessible name from that image's alt, so this is
    // announced once, not twice.
    img.alt = photoAlt(i, lvl.photos.length);

    btn.appendChild(img);
    btn.addEventListener("click", () => openLightbox(lvl.photos, i, photoAlt));
    gridEl.appendChild(btn);
  });
}

function showComingSoon() {
  tabsEl.innerHTML = "";
  toolbarEl.innerHTML = "";
  gridEl.innerHTML = "";
  statusEl.innerHTML = '<p class="coming-soon-banner">Photos haven\'t been posted yet. Check back after the game.</p>';
}

// A game that was played but not shot (noPhotos in lib/schedule.js).
function showNoPhotos() {
  tabsEl.innerHTML = "";
  toolbarEl.innerHTML = "";
  gridEl.innerHTML = "";
  statusEl.innerHTML = '<p class="coming-soon-banner">There are no photos from this game.</p>';
}

async function init() {
  // The grid ships with placeholder tiles so the page isn't blank while the
  // photo list loads; every exit path below has to clear them.
  if (!year || !week) {
    titleEl.textContent = "Week not found";
    gridEl.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(`/api/week/${encodeURIComponent(year)}/${encodeURIComponent(week)}`);
    if (!res.ok) {
      titleEl.textContent = "Week not found";
      gridEl.innerHTML = "";
      return;
    }
    const data = await res.json();

    weekInfo = { label: data.label, opponent: data.opponent || null, homeAway: data.homeAway || null };

    const phrase = opponentPhrase(data.opponent, data.homeAway);
    titleEl.textContent = weekHeading(data.label, data.opponent, data.homeAway);
    document.title = phrase
      ? `${data.label} ${phrase} | Seckman Jaguars Football`
      : `${data.label} | Seckman Jaguars Football`;

    // The eyebrow, scoreboard, caption and "more coming" note are all
    // server-rendered (prefillWeek in worker/lib/meta.js).

    if (data.status === "coming-soon") {
      showComingSoon();
      return;
    }

    if (data.status === "no-photos") {
      showNoPhotos();
      return;
    }

    levels = data.levels;
    activeLevel = levels[0]?.level;

    renderTabs();
    renderLevel();

    // Warms the counts for the whole week in one request, so the flame in the
    // viewer already has its number the moment a photo is opened.
    loadCounts(year, week);
  } catch (err) {
    titleEl.textContent = "Couldn't load this week";
    gridEl.innerHTML = "";
  }
}

init();
