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
    // The algorithm yields a UTC time-of-day, not a full instant. It has to be
    // wrapped into 0-24 and then pinned to the right calendar day: west of
    // Greenwich, sunset falls after midnight UTC, so it belongs to the
    // following UTC date. Anchoring to local solar noon picks the right day
    // for either hemisphere and any longitude.
    let UT = (((T - lngHour) % 24) + 24) % 24;

    const HOUR = 3600000;
    const solarNoon = Date.UTC(year, month - 1, day, 12) - lngHour * HOUR;
    let ts = Date.UTC(year, month - 1, day) + UT * HOUR;
    while (ts - solarNoon > 12 * HOUR) ts -= 24 * HOUR;
    while (solarNoon - ts > 12 * HOUR) ts += 24 * HOUR;

    return new Date(Math.round(ts / 60000) * 60000);
  }

  return { sunrise: calc(true), sunset: calc(false) };
}

function isAfterDarkNow() {
  const now = new Date();
  const DAY = 86400000;

  // Check the neighbouring solar days rather than just the current UTC date.
  // West of Greenwich the UTC date rolls over during the local evening, so
  // keying off it alone would compare an evening against the *next* day's
  // sunrise and wrongly report darkness before sunset.
  let anyValid = false;
  for (const offset of [-1, 0, 1]) {
    const probe = new Date(now.getTime() + offset * DAY);
    const { sunrise, sunset } = getSunTimes(probe, HOME_LAT, HOME_LON);
    if (!sunrise || !sunset) continue;
    anyValid = true;
    if (now >= sunrise && now < sunset) return false;
  }

  // Somewhere the sun never rises or sets today: defer to the OS preference.
  if (!anyValid) return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return true;
}

// Applies light or dark purely from the local sunrise/sunset times above.
// There is no manual override, so nothing is read from or written to storage.
function initTheme() {
  const html = document.documentElement;

  function applyTheme() {
    // Always set an explicit value rather than clearing the attribute: the
    // stylesheet's prefers-color-scheme block matches :root:not([data-theme="light"]),
    // so an absent attribute would force dark in daylight for anyone whose
    // OS is set to dark mode.
    html.setAttribute("data-theme", isAfterDarkNow() ? "dark" : "light");
  }

  applyTheme();
  // Re-check periodically so a tab left open flips at the real sunset/sunrise.
  setInterval(applyTheme, 15 * 60 * 1000);
}

initTheme();
