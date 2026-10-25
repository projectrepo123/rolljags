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
    `<tr data-number="${p.number}" data-pos="${escapeHtml(p.pos)}" data-class="${escapeHtml(p.class)}">` +
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

export function injectRoster(assetResponse, roster) {
  if (!roster) return assetResponse;
  const rows = roster.players.map(rowHtml).join("\n            ");
  return new HTMLRewriter()
    .on("#roster-tbody", { element: (el) => el.setInnerContent(rows, { html: true }) })
    .on("#roster-intro", { element: (el) => el.setInnerContent(summary(roster.players)) })
    .transform(assetResponse);
}
