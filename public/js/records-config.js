// The record book's categories, shared by /records (records.js) and the
// player pages (player.js), so a player's page ranks them exactly the way the
// record book does.

import { display } from "./records-ui.js";

// ------------------------------------------------------------ column shorthand

export const PLAYER = { label: "Player", key: "name" };
export const YEAR = { label: "Year", key: "year", format: (r) => display(r.year) };
export const OPPONENT = {
  label: "Opponent",
  key: "opponent",
  format: (r) => (r.playoff ? `${r.opponent} (Playoffs)` : r.opponent),
};

const col = (label, key, format) => ({ label, key, ...(format ? { format } : {}) });

// Stat columns shared by kicking / punting / both return categories.
const KICK_COLS = [col("Att", "attempts"), col("Yards", "yards"), col("Avg", "avg")];

const DEFENSE_COLS = [
  col("Tackles", "tackles"),
  col("Assists", "assists"),
  col("Total", "total"),
  col("Sacks", "sacks"),
  col("Fum Rec", "fumbleRec"),
  col("INT", "ints"),
  col("TD", "tds"),
];

/**
 * Every category the record book renders.
 *
 * `source` is the key in the scope's JSON, `rank` the field it sorts on, and
 * `stat` the column heading for that value on the card. Several categories share
 * one source and differ only by `rank`, which is how one defensive table
 * produces separate tackle, sack, interception and fumble leaderboards.
 */
export const GROUPS = {
  career: [
    {
      name: "Offense",
      categories: [
        { title: "Career Points", source: "scoring", rank: "totalPoints", stat: "Points",
          columns: [col("TD", "tds"), col("FG", "fgs"), col("2PT", "twoPt"), col("XP", "onePt"), col("Safety", "safety"), col("Points", "totalPoints")] },
        { title: "Passing Yards", source: "passing", rank: "yards", stat: "Yards",
          columns: [col("Comp", "completions"), col("Att", "attempts"), col("Pct", "pct"), col("Yards", "yards"), col("TD", "tds"), col("INT", "ints")] },
        { title: "Rushing Yards", source: "rushing", rank: "yards", stat: "Yards",
          columns: [col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Rushing Touchdowns", source: "rushing", rank: "tds", stat: "TD",
          columns: [col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Receiving Yards", source: "receiving", rank: "yards", stat: "Yards",
          columns: [col("Rec", "receptions"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Receiving Touchdowns", source: "receiving", rank: "tds", stat: "TD",
          columns: [col("Rec", "receptions"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "All-Purpose Yards", source: "totalYards", rank: "total", stat: "Yards",
          columns: [col("Rushing", "rushing"), col("Receiving", "receiving"), col("Total", "total")] },
      ],
    },
    {
      name: "Defense",
      categories: [
        { title: "Total Tackles", source: "defense", rank: "total", stat: "Total", columns: DEFENSE_COLS },
        { title: "Sacks", source: "defense", rank: "sacks", stat: "Sacks", columns: DEFENSE_COLS },
        { title: "Interceptions", source: "defense", rank: "ints", stat: "INT", columns: DEFENSE_COLS },
        { title: "Fumble Recoveries", source: "defense", rank: "fumbleRec", stat: "Fum Rec", columns: DEFENSE_COLS },
        { title: "Defensive Touchdowns", source: "defense", rank: "tds", stat: "TD", columns: DEFENSE_COLS },
      ],
    },
    {
      name: "Special Teams",
      categories: [
        { title: "Kickoff Yards", source: "kicking", rank: "yards", stat: "Yards", columns: KICK_COLS },
        { title: "Kickoff Average", source: "kicking", rank: "avg", stat: "Avg", columns: KICK_COLS },
        { title: "Punting Yards", source: "punting", rank: "yards", stat: "Yards", columns: KICK_COLS },
        { title: "Punting Average", source: "punting", rank: "avg", stat: "Avg", columns: KICK_COLS },
        { title: "Kick Return Yards", source: "kickReturn", rank: "yards", stat: "Yards", columns: KICK_COLS },
        { title: "Punt Return Yards", source: "puntReturn", rank: "yards", stat: "Yards", columns: KICK_COLS },
      ],
    },
  ],

  season: [
    {
      name: "Offense",
      categories: [
        { title: "Touchdowns in a Season", source: "scoring", rank: "tds", stat: "TD", nameKey: "player",
          columns: [col("TD", "tds")] },
        { title: "Passing Yards", source: "passing", rank: "yards", stat: "Yards",
          columns: [col("Comp", "completions"), col("Att", "attempts"), col("Pct", "pct"), col("Yards", "yards"), col("TD", "tds"), col("INT", "ints"), col("Rating", "rating")] },
        { title: "Passing Touchdowns", source: "passing", rank: "tds", stat: "TD",
          columns: [col("Comp", "completions"), col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("INT", "ints")] },
        { title: "Rushing Yards", source: "rushing", rank: "yards", stat: "Yards",
          columns: [col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Rushing Touchdowns", source: "rushing", rank: "tds", stat: "TD",
          columns: [col("Att", "attempts"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Receiving Yards", source: "receiving", rank: "yards", stat: "Yards",
          columns: [col("Rec", "receptions"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "Receiving Touchdowns", source: "receiving", rank: "tds", stat: "TD",
          columns: [col("Rec", "receptions"), col("Yards", "yards"), col("TD", "tds"), col("Avg", "avg")] },
        { title: "All-Purpose Yards", source: "totalYards", rank: "total", stat: "Yards",
          columns: [col("Rushing", "rushing"), col("Receiving", "receiving"), col("Total", "total")] },
      ],
    },
    {
      name: "Defense",
      categories: [
        { title: "Total Tackles", source: "defense", rank: "total", stat: "Total", columns: DEFENSE_COLS },
        { title: "Sacks", source: "defense", rank: "sacks", stat: "Sacks", columns: DEFENSE_COLS },
        { title: "Interceptions", source: "defense", rank: "ints", stat: "INT", columns: DEFENSE_COLS },
        { title: "Fumble Recoveries", source: "defense", rank: "fumbleRec", stat: "Fum Rec", columns: DEFENSE_COLS },
      ],
    },
    {
      name: "Special Teams",
      categories: [
        { title: "Kickoff Yards", source: "kicking", rank: "yards", stat: "Yards", columns: [...KICK_COLS, col("XP", "xp")] },
        { title: "Kickoff Average", source: "kicking", rank: "avg", stat: "Avg", columns: [...KICK_COLS, col("XP", "xp")] },
        { title: "Punting Yards", source: "punting", rank: "yards", stat: "Yards", columns: KICK_COLS },
        { title: "Punting Average", source: "punting", rank: "avg", stat: "Avg", columns: KICK_COLS },
        { title: "Kick Return Yards", source: "kickReturn", rank: "yards", stat: "Yards", columns: KICK_COLS },
        { title: "Punt Return Yards", source: "puntReturn", rank: "yards", stat: "Yards", columns: KICK_COLS },
      ],
    },
  ],

  game: [
    {
      name: "Offense",
      categories: [
        { title: "Touchdowns in a Game", source: "touchdowns", rank: "tds", stat: "TD", columns: [col("TD", "tds")] },
        { title: "Rushing Yards", source: "rushing", rank: "yards", stat: "Yards",
          columns: [col("Yards", "yards"), col("Att", "attempts"), col("YPC", "ypc")] },
        { title: "Passing Yards", source: "passing", rank: "yards", stat: "Yards",
          columns: [col("Yards", "yards"), col("Comp", "completions"), col("Att", "attempts"), col("TD", "tds")] },
        { title: "Receiving Yards", source: "receiving", rank: "yards", stat: "Yards",
          columns: [col("Yards", "yards"), col("Rec", "receptions"), col("TD", "tds")] },
      ],
    },
    {
      name: "Defense",
      categories: [
        { title: "Tackles in a Game", source: "tackles", rank: "tackles", stat: "Tackles", columns: [col("Tackles", "tackles")] },
        { title: "Sacks in a Game", source: "sacks", rank: "sacks", stat: "Sacks", columns: [col("Sacks", "sacks")] },
        { title: "Interceptions in a Game", source: "interceptions", rank: "ints", stat: "INT", columns: [col("INT", "ints")] },
        { title: "Fumble Recoveries in a Game", source: "fumbles", rank: "fumbles", stat: "Fum Rec", columns: [col("Fum Rec", "fumbles")] },
        { title: "Interception & Fumble Return TDs", source: "returnTds", rank: "yards", stat: "Yards", columns: [col("Return Yards", "yards")] },
      ],
    },
    {
      name: "Special Teams",
      categories: [
        { title: "Return Touchdowns", source: "returnTouchdowns", rank: "yards", stat: "Yards",
          columns: [col("Type", "type"), col("Yards", "yards")] },
        { title: "Punt Return Yards", source: "puntReturnYards", rank: "yards", stat: "Yards",
          columns: [col("Returns", "returns"), col("Yards", "yards")] },
      ],
    },
  ],
};

// Columns prepended to every full table, by scope.
export const LEAD_COLUMNS = {
  career: [PLAYER],
  season: [YEAR, PLAYER],
  game: [YEAR, OPPONENT, PLAYER],
};

export const SCOPE_LABELS = { career: "Career", season: "Single Season", game: "Single Game" };

/** The player/name field varies: single-season scoring uses "player". */
export function nameOf(row, category) {
  return row[category.nameKey || "name"] ?? "";
}

export function leaderboardLabel(row, scope, category) {
  const name = nameOf(row, category);
  // Many single-season rows have no usable year in the source, so drop the
  // parenthetical entirely rather than printing an empty one.
  if (scope === "season") return row.year ? `${name} (${row.year})` : name;
  if (scope === "game") {
    const opponent = row.playoff ? `${row.opponent} (Playoffs)` : row.opponent;
    return `${name} vs ${opponent}`;
  }
  return name;
}
