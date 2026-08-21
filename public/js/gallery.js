import { openLightbox } from "./lightbox.js";

const params = new URLSearchParams(location.search);
const year = params.get("year");
const week = params.get("week");

const titleEl = document.getElementById("week-title");
const captionEl = document.getElementById("week-caption");
const tabsEl = document.getElementById("level-tabs");
const toolbarEl = document.getElementById("level-toolbar");
const gridEl = document.getElementById("photo-grid");
const statusEl = document.getElementById("week-status");

let levels = [];
let activeLevel = null;
let caption = "";
let weekLabel = "";

// A regular-season week is always titled "Week N ..." (see formatWeekLabel in
// worker/lib/r2.js); a custom-labelled week (a scrimmage, a photo day) isn't
// tied to one roster level the way a normal game's varsity/JV/freshman split
// is, so its single level tab would misleadingly claim "Varsity" for photos
// that mix every level. Show its caption there instead of a level name.
function isCustomLabelWeek(label) {
  return !/^Week \d+/.test(label || "");
}

function renderTabs() {
  tabsEl.innerHTML = "";

  if (levels.length === 1 && isCustomLabelWeek(weekLabel) && caption) {
    const label = document.createElement("span");
    label.className = "level-tab active level-tab-static";
    label.textContent = caption;
    tabsEl.appendChild(label);
    return;
  }

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

function renderLevel() {
  const lvl = levels.find((l) => l.level === activeLevel);
  if (!lvl) return;

  toolbarEl.innerHTML = "";
  const count = document.createElement("span");
  count.className = "photo-count";
  count.textContent = `${lvl.photos.length} photo${lvl.photos.length === 1 ? "" : "s"}`;
  toolbarEl.appendChild(count);

  const zipLink = document.createElement("a");
  zipLink.className = "btn btn-gold";
  zipLink.href = `/api/zip/${encodeURIComponent(year)}/${encodeURIComponent(week)}/${encodeURIComponent(lvl.level)}`;
  zipLink.textContent = "Download all (.zip)";
  toolbarEl.appendChild(zipLink);

  gridEl.innerHTML = "";
  lvl.photos.forEach((photo, i) => {
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", `Open photo ${i + 1} of ${lvl.photos.length}`);

    const img = document.createElement("img");
    img.src = photo.thumbUrl;
    img.loading = "lazy";
    // The button already carries the label; an identical alt would make a
    // screen reader announce the same thing twice.
    img.alt = "";

    btn.appendChild(img);
    btn.addEventListener("click", () => openLightbox(lvl.photos, i));
    gridEl.appendChild(btn);
  });
}

function showComingSoon() {
  tabsEl.innerHTML = "";
  toolbarEl.innerHTML = "";
  gridEl.innerHTML = "";
  statusEl.innerHTML = '<p class="coming-soon-banner">Photos haven\'t been posted yet. Check back after the game.</p>';
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

    titleEl.textContent = data.label;
    document.title = `${data.label} | Jaguar Football`;
    weekLabel = data.label;
    caption = data.caption || "";

    if (data.status === "coming-soon") {
      captionEl.textContent = caption;
      showComingSoon();
      return;
    }

    levels = data.levels;
    activeLevel = levels[0]?.level;

    // A single-level, custom-labelled week (see renderTabs) shows its caption
    // as the level tab instead, so it isn't repeated verbatim right under a
    // title that already says the same thing.
    const captionMovedToTabs = levels.length === 1 && isCustomLabelWeek(data.label) && caption;
    captionEl.textContent = captionMovedToTabs ? "" : caption;

    renderTabs();
    renderLevel();
  } catch (err) {
    titleEl.textContent = "Couldn't load this week";
    gridEl.innerHTML = "";
  }
}

init();
