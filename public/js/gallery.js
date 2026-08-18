import { openLightbox } from "./lightbox.js";

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
    btn.setAttribute("aria-label", `Open ${photo.name}`);

    const img = document.createElement("img");
    img.src = photo.thumbUrl;
    img.loading = "lazy";
    img.alt = photo.name;

    btn.appendChild(img);
    btn.addEventListener("click", () => openLightbox(lvl.photos, i));
    gridEl.appendChild(btn);
  });
}

function showComingSoon() {
  tabsEl.innerHTML = "";
  toolbarEl.innerHTML = "";
  gridEl.innerHTML = "";
  statusEl.innerHTML = '<p class="coming-soon-banner">Photos haven\'t been posted yet — check back after the game.</p>';
}

async function init() {
  if (!year || !week) {
    titleEl.textContent = "Week not found";
    return;
  }

  try {
    const res = await fetch(`/api/week/${encodeURIComponent(year)}/${encodeURIComponent(week)}`);
    if (!res.ok) {
      titleEl.textContent = "Week not found";
      return;
    }
    const data = await res.json();

    titleEl.textContent = data.label;
    document.title = `${data.label} — Seckman Football`;

    if (data.status === "coming-soon") {
      showComingSoon();
      return;
    }

    levels = data.levels;
    activeLevel = levels[0]?.level;

    renderTabs();
    renderLevel();
  } catch (err) {
    titleEl.textContent = "Couldn't load this week";
  }
}

init();
