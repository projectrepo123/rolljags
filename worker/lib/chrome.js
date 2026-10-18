// The site header and footer, written once and filled into every HTML page by
// the worker (see decorateHtml in index.js). Each page in public/ ships an
// empty <header class="site-header"> and <footer class="site-footer">.
//
// nav.js and countdown.js look these elements up by id, so keep nav-links,
// nav-toggle and the kickoff-* ids as they are.

const NAV = [
  { href: "/", label: "Photos" },
  { href: "/schedule", label: "Schedule" },
  { href: "/history", label: "History" },
  { href: "/records", label: "Records" },
  { href: "/roster", label: "Roster" },
];

// Which tab a page belongs under. A gallery is part of Photos and a single
// season is part of History; anything unlisted (the 404 page) marks nothing.
const SECTION_BY_PAGE = {
  "": "/",
  index: "/",
  week: "/",
  schedule: "/schedule",
  history: "/history",
  season: "/history",
  records: "/records",
  roster: "/roster",
  podcast: "/podcast",
};

function activeHref(pathname) {
  const page = pathname.replace(/^\/+|\/+$/g, "").replace(/\.html$/, "");
  return SECTION_BY_PAGE[page] ?? null;
}

export function headerHtml(pathname) {
  const active = activeHref(pathname);
  const links = NAV.map(({ href, label }) =>
    href === active
      ? `<a href="${href}" class="active" aria-current="page">${label}</a>`
      : `<a href="${href}">${label}</a>`
  ).join("\n          ");

  return `
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="container header-inner">
      <a class="brand" href="/">
        <img class="site-logo" src="/logo.webp" width="512" height="409" alt="Jaguar Football logo" />
        <span class="brand-name">Jaguar<span class="brand-tail"> Football</span></span>
      </a>
      <nav class="site-nav" aria-label="Main">
        <div class="nav-links" id="nav-links">
          ${links}
          <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Switch theme" aria-pressed="false">
            <svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>
            <svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>
            <span class="theme-toggle-text">Theme</span>
          </button>
        </div>
        <span class="kickoff-countdown" id="kickoff-countdown" hidden>
          <span class="kickoff-label" id="kickoff-label">Kickoff</span>
          <span class="kickoff-clock" id="kickoff-clock"></span>
        </span>
        <button class="nav-toggle" id="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="nav-links">
          <span class="nav-toggle-bar"></span>
          <span class="nav-toggle-bar"></span>
          <span class="nav-toggle-bar"></span>
        </button>
      </nav>
    </div>
  `;
}

const SOCIAL = [
  { href: "https://www.facebook.com/p/Jaguar-Football-Booster-Club-61558713380822/", label: "Facebook" },
  { href: "https://www.instagram.com/seckmanfootball/", label: "Instagram" },
  { href: "/podcast", label: "Podcast" },
];

export const FOOTER_HTML = `
    <div class="container footer-inner">
      <div class="footer-brand">
        <img class="footer-logo" src="/logo.webp" width="512" height="409" alt="" loading="lazy" />
        <div>
          <p>Jaguar Football</p>
          <p class="footer-credit">Photos and Website by <a href="https://jbwebco.com">Jon Baer</a></p>
          <p class="footer-support">
            <a href="https://venmo.com/u/jonlol" title="Helps cover camera gear and hosting. Totally optional, and not affiliated with the school.">Thanks for the memories</a>
          </p>
        </div>
      </div>
      <nav class="footer-links" aria-label="Footer">
        ${NAV.map(({ href, label }) => `<a href="${href}">${label}</a>`).join("\n        ")}
      </nav>
      <div class="footer-links footer-social">
        ${SOCIAL.map(({ href, label }) => `<a href="${href}">${label}</a>`).join("\n        ")}
      </div>
    </div>
  `;
