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
  { href: "/podcast", label: "Podcast" },
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
        <span class="brand-name">Jaguar Football</span>
      </a>
      <nav class="site-nav" aria-label="Main">
        <div class="nav-links" id="nav-links">
          ${links}
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

export const FOOTER_HTML = `
    <div class="container">
      <p>Jaguar Football</p>
      <p class="footer-credit">Photos and Website by <a href="https://jbwebco.com">Jon Baer</a></p>
      <p class="footer-support">
        <a href="https://venmo.com/u/jonlol" title="Helps cover camera gear and hosting. Totally optional, and not affiliated with the school.">Thanks for the memories</a>
      </p>
    </div>
  `;
