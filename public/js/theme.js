// Approximate coordinates for the team's home area (Arnold, MO), used only
// to pick a sensible default light/dark theme based on real sunrise/sunset.
const HOME_LAT = 38.4348;
const HOME_LON = -90.3765;

// Classic "Sunrise/Sunset Algorithm" (Almanac for Computers, 1990). Works
// entirely in UTC, so it's unaffected by the visitor's timezone/DST.
function getSunTimes(date, lat, lon) {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const zenith = 90.833;

  function calc(isSunrise) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    const N1 = Math.floor(275 * month / 9);
    const N2 = Math.floor((month + 9) / 12);
    const N3 = 1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3);
    const N = N1 - (N2 * N3) + day - 30;

    const lngHour = lon / 15;
    const t = isSunrise ? N + ((6 - lngHour) / 24) : N + ((18 - lngHour) / 24);

    const M = (0.9856 * t) - 3.289;
    let L = M + (1.916 * Math.sin(M * rad)) + (0.020 * Math.sin(2 * M * rad)) + 282.634;
    L = ((L % 360) + 360) % 360;

    let RA = deg * Math.atan(0.91764 * Math.tan(L * rad));
    RA = ((RA % 360) + 360) % 360;
    const Lquadrant = Math.floor(L / 90) * 90;
    const RAquadrant = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquadrant - RAquadrant)) / 15;

    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));

    const cosH = (Math.cos(zenith * rad) - (sinDec * Math.sin(lat * rad))) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return null; // sun never rises/sets here today

    let H = isSunrise ? 360 - deg * Math.acos(cosH) : deg * Math.acos(cosH);
    H /= 15;

    const T = H + RA - (0.06571 * t) - 6.622;
    const UT = T - lngHour;

    const hours = Math.floor(UT);
    const minutes = Math.round((UT - hours) * 60);
    return new Date(Date.UTC(year, month - 1, day, hours, minutes));
  }

  return { sunrise: calc(true), sunset: calc(false) };
}

function isAfterDarkNow() {
  const now = new Date();
  const { sunrise, sunset } = getSunTimes(now, HOME_LAT, HOME_LON);
  if (!sunrise || !sunset) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return now < sunrise || now >= sunset;
}

// Storage can throw in private-browsing modes; a failure to remember the
// preference shouldn't stop the theme from switching for this page view.
function readStored() {
  try {
    return localStorage.getItem("theme");
  } catch (err) {
    return null;
  }
}

function writeStored(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch (err) {
    /* preference just won't persist */
  }
}

function initTheme() {
  const html = document.documentElement;
  let autoTimer = null;
  let current = "light";

  // The button lives in <body>, which doesn't exist yet when this file runs
  // (it's loaded in <head> without defer so the theme is set before first
  // paint and the page never flashes the wrong colours). So the button is
  // looked up each time rather than captured once at startup.
  function syncToggle() {
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    const isDark = current === "dark";
    // The button says what it will switch you to, not what you're on now.
    const icon = toggle.querySelector(".theme-toggle-icon");
    const label = toggle.querySelector(".theme-toggle-label");
    if (icon) icon.textContent = isDark ? "☀️" : "🌙";
    if (label) label.textContent = isDark ? "Light mode" : "Dark mode";

    toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    toggle.setAttribute("aria-pressed", String(isDark));
  }

  function applyTheme(theme) {
    current = theme;
    if (theme === "dark") {
      html.setAttribute("data-theme", "dark");
    } else {
      html.removeAttribute("data-theme");
    }
    syncToggle();
  }

  // Explicit choice: persists and overrides the sunrise/sunset auto-switch.
  function setTheme(theme) {
    applyTheme(theme);
    writeStored(theme);
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function toggleTheme() {
    setTheme(current === "dark" ? "light" : "dark");
  }

  const saved = readStored();
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
  } else {
    applyTheme(isAfterDarkNow() ? "dark" : "light");
    // Re-check periodically so a tab left open flips at the actual sunset/sunrise.
    autoTimer = setInterval(() => {
      applyTheme(isAfterDarkNow() ? "dark" : "light");
    }, 15 * 60 * 1000);
  }

  function wireToggle() {
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", toggleTheme);
    // Label/icon still show the head-time defaults until this first sync.
    syncToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireToggle);
  } else {
    wireToggle();
  }
}

initTheme();
