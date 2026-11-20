// The current roster lives in public/data/roster.json, the one place to edit
// it. /roster gets its table rows written in here, so the list is in the HTML
// for crawlers and for anyone without JavaScript; roster.js then turns those
// rows into cards. /player pages and the record book links read the same file.

const GRADE = { "Sr.": 12, "Jr.": 11, "So.": 10, "Fr.": 9 };
const CLASS_WORD = { "Sr.": "seniors", "Jr.": "juniors", "So.": "sophomores", "Fr.": "freshmen" };

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function loadRoster(env, origin) {
  const res = await env.ASSETS.fetch(new Request(`${origin}/data/roster.json`));
  if (!res.ok) return null;
  return res.json();
}

export function findPlayer(roster, n) {
  if (!roster || !/^\d{1,2}$/.test(n || "")) return null;
  return roster.players.find((p) => p.number === Number(n)) || null;
}

function rowHtml(p) {
  const grade = GRADE[p.class];
  const cls = grade ? `<abbr title="Grade ${grade}">${escapeHtml(p.class)}</abbr>` : escapeHtml(p.class);
  return (
    `<tr data-number="${p.number}" data-pos="${escapeHtml(p.pos)}" data-class="${escapeHtml(p.class)}"` +
    (p.allConference ? ` data-honor="${escapeHtml(`All-Conf ${TEAM_LABEL[p.allConference.team] || ""}`.trim())}"` : "") +
    `>` +
    `<td class="roster-num">${p.number}</td>` +
    `<td class="roster-name"><a href="/player?n=${p.number}">${escapeHtml(p.name)}</a></td>` +
    `<td>${escapeHtml(p.pos)}</td><td>${cls}</td></tr>`
  );
}

// "61 players: 21 seniors, 32 juniors and 8 sophomores."
function summary(players) {
  const parts = Object.keys(CLASS_WORD)
    .map((c) => [players.filter((p) => p.class === c).length, CLASS_WORD[c]])
    .filter(([count]) => count > 0)
    .map(([count, word]) => `${count} ${word}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts.join("");
  return `${players.length} players: ${list}.`;
}

// All-conference picks are an `allConference: { team, pos }` field on the
// player in roster.json. The order inside each team follows the graphic.
const HONOR_SIDES = [
  ["Offense", ["WR", "RB", "OL", "Athlete"]],
  ["Defense", ["LB", "DB", "DL"]],
];
const TEAM_LABEL = { 1: "1st Team", 2: "2nd Team" };

function honorsHtml(roster) {
  const honored = roster.players.filter((p) => p.allConference);
  if (honored.length === 0) return "";

  const sides = HONOR_SIDES.map(([side, order]) => {
    const teams = [1, 2].map((team) => {
      const picks = honored
        .filter((p) => p.allConference.team === team && order.includes(p.allConference.pos))
        .sort((a, b) => order.indexOf(a.allConference.pos) - order.indexOf(b.allConference.pos));
      if (picks.length === 0) return "";
      const items = picks
        .map(
          (p) =>
            `<li><a href="/player?n=${p.number}"><span class="ac-pos">${escapeHtml(p.allConference.pos)}</span>` +
            `<span class="ac-name">${escapeHtml(p.name)}</span></a></li>`
        )
        .join("");
      return `<h4 class="ac-team ac-team-${team}">${TEAM_LABEL[team]}</h4><ul class="ac-list">${items}</ul>`;
    });
    return `<div class="ac-side"><h3>${side}</h3>${teams.join("")}</div>`;
  });

  const full = "/img/all-conference-2026.jpg";
  return (
    `<h2 class="section-heading">${roster.year} All-Conference</h2>` +
    `<div class="ac-card">` +
    `<a class="ac-graphic" href="${full}" target="_blank" rel="noopener">` +
    `<img src="/img/all-conference-2026.webp" srcset="/img/all-conference-2026-720.webp 720w, /img/all-conference-2026.webp 1080w" ` +
    `sizes="(max-width: 760px) 100vw, 360px" width="1080" height="1350" loading="lazy" decoding="async" ` +
    `alt="Seckman Jaguar Football ${roster.year} All-Conference graphic listing ${honored.length} honorees" /></a>` +
    `<div class="ac-body"><p class="ac-intro">${honored.length} Jaguars made the ${roster.year} all-conference teams.</p>` +
    `<div class="ac-sides">${sides.join("")}</div>` +
    `<a class="btn btn-gold ac-download" href="${full}" download="Seckman-All-Conference-${roster.year}.jpg">Download the graphic</a>` +
    `</div></div>`
  );
}

export function injectRoster(assetResponse, roster) {
  if (!roster) return assetResponse;
  const rows = roster.players.map(rowHtml).join("\n            ");
  const honors = honorsHtml(roster);
  return new HTMLRewriter()
    .on("#roster-tbody", { element: (el) => el.setInnerContent(rows, { html: true }) })
    .on("#roster-intro", { element: (el) => el.setInnerContent(summary(roster.players)) })
    .on("#roster-honors", {
      element: (el) => {
        if (!honors) return;
        el.setInnerContent(honors, { html: true });
        el.removeAttribute("hidden");
      },
    })
    .transform(assetResponse);
}
