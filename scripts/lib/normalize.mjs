// Cleanup rules for the record-book workbooks.
//
// The spreadsheets are decades of hand entry across several coaching staffs, so
// the same player shows up under several spellings and Excel has silently
// rewritten a lot of "7-4"-looking cells into dates. Everything needed to undo
// that lives here so `import-stats.mjs` stays readable and there is exactly one
// place to add a new alias.
//
// Every rule below was verified by reconciling against the site's existing
// history.json / records.json, which match the source exactly for 2005-2025.

// ---------------------------------------------------------------- name aliases

/**
 * Misspelling -> canonical player name.
 *
 * Only clear variants of one person are listed. Names that merely look similar
 * are deliberately absent because they are different people: Kyle vs. Tyler
 * Fisher, Nick Baer vs. Nick Baum, Jim vs. Tom Becnel, Blake vs. Luke Johnson,
 * Kyle Gross vs. Kyle Rose, Grant vs. Luckas Salsman, Brock vs. Eli
 * Wingbermuehle, Jordan Lieschidt vs. Justin Liescheidt, Mason vs. Miles
 * McPheeters, Dylan vs. Ryon Melton.
 *
 * Keys are matched after case/whitespace/punctuation folding (see nameKey), so
 * pure casing and double-space variants need no entry.
 */
export const NAME_ALIASES = {
  "Alec Ferbet": "Alek Ferbet",
  "Andrew Krause": "Andrew Kraus",
  "Anthoney Westervelt": "Anthony Westervelt",
  "Athoney Westervelt": "Anthony Westervelt",
  "Cam Benson": "Cameron Benson",
  "Christian Phillip": "Christian Philipp",
  "Cole Rubel": "Cole Ruble",
  "Connor Day": "Conner Day",
  "Corey Bugg": "Corey Buggy",
  "Dom Lograsso": "Dominic Lograsso",
  "Dom Medieros": "Dominic Medioros",
  "Drew Campell": "Drew Campbell",
  "Edzui Franzack": "Edziu Franczak",
  "Eil Wingbermuehle": "Eli Wingbermuehle",
  "Eli WIngberuehle": "Eli Wingbermuehle",
  "Eli Wingo": "Eli Wingbermuehle",
  "Gage Earhart": "Gage Erhart",
  "Gage Erhardt": "Gage Erhart",
  "Jake Seiler": "Jacob Seiler",
  "Jaydon Ashlock": "Jayden Ashlock",
  "Jesse Zenhoffer": "Jesse Zenthoeffer",
  "John Weigers": "John Wiegers",
  "Jordon Scott": "Jordan Scott",
  "Kade Heinemeir": "Kade Heinemeier",
  "Kyle Fisher*": "Kyle Fisher",
  "Lukas Salsmann": "Luckas Salsman",
  "Luke Salsman": "Luckas Salsman",
  "Matt Guidcey": "Matt Giudicy",
  "Matt Guidicy": "Matt Giudicy",
  "Mudzahid Radislic": "Mudzahid Radaslic",
  "Neecho Mason": "Necho Mason",
  "Noah Leweicke": "Noah Leiweicke",
  "Otto Pfneissel": "Otto Pfneisel",
  "Phillip Bailey": "Phil Bailey",
  "Rez Micu": "Rares Micu",
  "Ron Lowrey": "Ron Lowry",
  "Ronnie Lowry": "Ron Lowry",
  "Ryan Melton": "Ryon Melton",
  "Sam Trammel": "Sam Tramel",
  "Seth Lounsbary": "Seth Lounsbury",
  "Seth Lounsberry": "Seth Lounsbury",
  "Steve Browlee": "Steve Brownlee",
  "Tom Bechel": "Tom Becnel",
  "Tony Berkemeier": "Tony Bekemeier",
};

/**
 * Cells that are a jersey number rather than a name ("#26"). The stat line is
 * real but cannot be attributed to anyone, so these rows are dropped and counted
 * in the import report instead of appearing as a phantom player.
 */
export function isPlaceholderName(raw) {
  return /^#?\s*\d+$/.test(String(raw ?? "").trim());
}

/**
 * Surname-only cells that can be resolved from context without guessing.
 * Everything else with no first name is reported rather than invented.
 */
export const BARE_SURNAMES = {
  Barbosa: "Jacob Barbosa",
  Bizub: "Kevin Bizub",
  Harper: "Tyler Harper",
  Moeckel: "Dean Moeckel",
  Rigden: "Matt Rigdon",
};

/** Surname-only cells with more than one plausible owner — left alone. */
export const AMBIGUOUS_NAMES = new Set(["Kraus", "Thomas", "Gibbar/Kube"]);

function nameKey(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const NAME_LOOKUP = new Map();
for (const [from, to] of Object.entries(NAME_ALIASES)) NAME_LOOKUP.set(nameKey(from), to);
for (const [from, to] of Object.entries(BARE_SURNAMES)) NAME_LOOKUP.set(nameKey(from), to);

/** Collapses whitespace, then applies the alias table. */
export function normalizeName(raw) {
  const trimmed = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return NAME_LOOKUP.get(nameKey(trimmed)) ?? trimmed;
}

// ------------------------------------------------------------ opponent aliases

/**
 * Schedule/record spellings -> the canonical names history.json already uses.
 * Getting these wrong splits the head-to-head table, so they map onto the exact
 * strings already present in the site's data.
 */
export const OPPONENT_ALIASES = {
  "Northwest Cedar Hill": "Northwest",
  Summit: "Rockwood Summit",
  "U City": "University City",
  UCity: "University City",
  Ucity: "University City",
  "U CIty": "University City",
  "De Soto": "DeSoto",
  Desoto: "DeSoto",
  "Cape Girardeau Central": "Central (Cape Girardeau)",
  "Cape Girardeau": "Central (Cape Girardeau)",
  "Cape Girardeua": "Central (Cape Girardeau)",
  "Park Hills Central": "Central (Park Hills)",
  "Park Hill Central": "Central (Park Hills)",
  "Francis Howell North": "Howell North",
  Ladue: "Ladue Horton Watkins",
  SLUH: "St. Louis University",
  "Windsor (Imperial)": "Windsor",
  Webster: "Webster Groves",
  Oakvile: "Oakville",
  Oakvilee: "Oakville",
  "Parway West": "Parkway West",
  "Parway South": "Parkway South",
  "Parkway Norgh": "Parkway North",
  "Valle Cathlic": "Valle Catholic",
  Eureak: "Eureka",
  Mehlvile: "Mehlville",
  "Fort Zummwalt South": "Fort Zumwalt South",
  "Hazelwood Central": "Hazelwood Central",
  Marquette: "Marquette",
};

const OPPONENT_LOOKUP = new Map();
for (const [from, to] of Object.entries(OPPONENT_ALIASES)) OPPONENT_LOOKUP.set(nameKey(from), to);

/**
 * Normalizes an opponent, stripping the "(Playoffs)" annotation the single-game
 * tabs append. Returns the name plus whether it was flagged as a playoff game.
 */
export function normalizeOpponent(raw) {
  let text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { opponent: "", playoff: false };

  let playoff = false;
  text = text.replace(/\s*\((playoffs?|playoff)\)\s*$/i, () => {
    playoff = true;
    return "";
  }).trim();

  return { opponent: OPPONENT_LOOKUP.get(nameKey(text)) ?? text, playoff };
}

// ------------------------------------------------------------- Excel decoding

// Excel day 1 is 1900-01-01, and it wrongly treats 1900 as a leap year, which
// this epoch (1899-12-30) absorbs for every date after 1900-03-01.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** Excel serial -> {year, month, day} in UTC. */
export function serialToDate(serial) {
  const d = new Date(EXCEL_EPOCH_MS + Math.round(serial) * 86400000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Undoes Excel's autocorrect on "wins-losses" cells.
 *
 * Typing `1-5` into a General cell makes Excel store the *date* January 5 as a
 * serial. Only the month and day survive and they are exactly the two numbers
 * that were typed, so the record reads back as `month-day`. The serial's year is
 * an artifact of whenever the sheet was edited and is meaningless.
 *
 * Verified: 44931 -> Jan 5 -> "1-5" is the 2000 record after six games (1 win,
 * 5 losses), and 45200 -> Oct 1 -> "10-1" is 2023's final record.
 */
export function decodeRecordCell(raw) {
  // Team Stats appends an all-time rank, e.g. "5-5 (7)". Strip it before
  // decoding so the caller can re-attach it exactly once.
  const text = String(raw ?? "").replace(/\s*\(\d+\)\s*$/, "").trim();
  if (!text) return "";

  // Already a plain record like "10-1" or "0-10".
  if (/^\d+\s*-\s*\d+(\s*-\s*\d+)?$/.test(text)) return text.replace(/\s/g, "");

  const n = Number(text);
  if (Number.isFinite(n) && n > 20000) {
    const { month, day } = serialToDate(n);
    return `${month}-${day}`;
  }
  return text;
}

/**
 * Splits a score cell into Seckman's points and the opponent's.
 *
 * These sheets record scores winner-first, not Seckman-first, so the W/L flag
 * decides which number is ours. Verified against 1999 (first numbers sum to the
 * season's points-against, second numbers to points-for) and 2000, which only
 * reconciles to its 72/271 under this rule.
 *
 * Score cells are subject to the same date autocorrect as records, so `45267`
 * has to be read back as `12-7`.
 *
 * @param {string} raw    the score cell
 * @param {string} result "W", "L", "T", or "?"
 */
export function parseScore(raw, result) {
  const decoded = decodeRecordCell(raw);
  const m = decoded.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return null;

  const high = parseInt(m[1], 10);
  const low = parseInt(m[2], 10);
  const flag = String(result ?? "").trim().toUpperCase();

  // A tie has nothing to order; an unknown result is reported by the caller.
  if (flag === "W") return { pointsFor: high, pointsAgainst: low };
  if (flag === "L") return { pointsFor: low, pointsAgainst: high };
  return { pointsFor: high, pointsAgainst: low };
}

/**
 * Reads the schedule's "Event" text.
 *
 *   "Oakville"                        -> home
 *   "at Oakville"                     -> away
 *   "vs Webster Groves at Moss Field" -> neutral site
 *
 * history.json has only Home/Away, and records the two existing neutral-site
 * games either way, so neutral is reported as Away — a neutral site is not a
 * home game.
 */
export function parseEvent(raw) {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const neutral = text.match(/^vs\.?\s+(.+?)\s+at\s+.+$/i);
  if (neutral) {
    return { ...normalizeOpponent(neutral[1]), homeAway: "Away", neutral: true };
  }

  const away = text.match(/^at\s+(.+)$/i);
  if (away) {
    return { ...normalizeOpponent(away[1]), homeAway: "Away", neutral: false };
  }

  return { ...normalizeOpponent(text.replace(/^vs\.?\s+/i, "")), homeAway: "Home", neutral: false };
}

// ------------------------------------------------------------------- numbers

/** Cell -> number, or null when blank/non-numeric. Tolerates "1,234" and "-2". */
export function num(raw) {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Like num(), but rounds — most of these cells are integers stored as "12.0". */
export function int(raw) {
  const n = num(raw);
  return n === null ? null : Math.round(n);
}

/**
 * Reads the year column, which in five Single Season tabs is labelled "#" and
 * holds a mix of seasons and jersey numbers. Anything outside a plausible
 * season is not a year.
 */
export function year(raw) {
  const n = num(raw);
  if (n === null) return null;
  return n >= 1990 && n <= 2030 ? Math.round(n) : null;
}

/**
 * Keeps a program-rank annotation like "523 (1)" intact for display while
 * remaining sortable. The site already renders the "(N)" as a superscript badge
 * (formatStatCell) and sorts on the leading number (parseNumericValue), so these
 * cells are passed through as strings rather than flattened to numbers.
 */
export function statCell(raw) {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    return Number.isInteger(n) ? n : n;
  }
  // "251 (6)" / "36.8 (2)" / ".91 (1)"
  if (/^\.?\d/.test(text)) return text;
  return text;
}
