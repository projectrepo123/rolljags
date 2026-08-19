export function computeRecord(games) {
  let wins = 0, losses = 0, ties = 0;
  for (const game of games) {
    if (game.result === "W") wins++;
    else if (game.result === "L") losses++;
    else if (game.result === "T") ties++;
  }
  return { wins, losses, ties };
}

export function recordString(record) {
  let str = `${record.wins}-${record.losses}`;
  if (record.ties > 0) str += `-${record.ties}`;
  return str;
}

export function resultDisplay(game) {
  const symbol = game.result === "W" ? "W" : game.result === "L" ? "L" : "T";
  return `${symbol} ${game.pointsFor}-${game.pointsAgainst}`;
}

export function createCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

export function parseNumericValue(str) {
  if (!str) return 0;
  const match = str.toString().match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

// Formats a "value (rank)" style stat string (e.g. "1234 (3)") into a text
// node plus a superscript rank, so leaderboard tables can show the rank
// inline without a separate column. Returns plain content (not a <td>) so
// callers can drop it straight into a cell via renderTable.
export function formatStatCell(raw) {
  const frag = document.createDocumentFragment();
  if (raw === null || raw === undefined || raw === "") return frag;
  const str = String(raw);
  const match = str.match(/^(.+?)\s*\((\d+)\)$/);
  if (!match) {
    frag.appendChild(document.createTextNode(str));
    return frag;
  }
  frag.appendChild(document.createTextNode(match[1]));
  const rank = document.createElement("sup");
  rank.className = "stat-rank";
  rank.textContent = match[2];
  frag.appendChild(rank);
  return frag;
}

function fillCell(td, value) {
  if (value instanceof Node) td.appendChild(value);
  else td.textContent = value ?? "";
}

// Generic table builder: columns is [{ label, cell(row) => text|Node }].
// footCells(col), if given, renders a <tfoot> row using the same columns.
export function renderTable(columns, rows, { className = "records-table", footCells = null } = {}) {
  const table = document.createElement("table");
  table.className = className;

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    th.textContent = col.label;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const col of columns) {
      const td = document.createElement("td");
      fillCell(td, col.cell(row));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  if (footCells) {
    const tfoot = document.createElement("tfoot");
    const footRow = document.createElement("tr");
    for (const col of columns) {
      const td = document.createElement("td");
      fillCell(td, footCells(col));
      footRow.appendChild(td);
    }
    tfoot.appendChild(footRow);
    table.appendChild(tfoot);
  }

  return table;
}

// Wraps a table (or any content) in the collapsible <details class="records-section">
// shell used across the History page's leaderboard/records tables.
export function renderRecordsSection(id, title, countText, contentEl, { scroll = true } = {}) {
  const details = document.createElement("details");
  details.id = id;
  details.className = "records-section";

  const summary = document.createElement("summary");
  summary.innerHTML = `<strong>${title}</strong> <span class="record-count">${countText}</span>`;
  details.appendChild(summary);

  if (scroll) {
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "table-scroll";
    scrollContainer.appendChild(contentEl);
    details.appendChild(scrollContainer);
  } else {
    details.appendChild(contentEl);
  }

  return details;
}

// Maps a list through mapFn (which must return { value, ... }), sorts
// descending by numeric value, and takes the top n.
export function topByValue(list, mapFn, n = 10) {
  return list
    .map(mapFn)
    .sort((a, b) => parseNumericValue(b.value) - parseNumericValue(a.value))
    .slice(0, n);
}
