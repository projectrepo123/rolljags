// Shared record-book UI: the leaderboard card, the "View all" modal, and the
// searchable table both /history and /records render.
//
// These started out private to history.js. /records needs the same pieces for
// ~28 categories, so they live here instead of being duplicated.

// ------------------------------------------------------------------ formatting

/**
 * Builds a <td>, rendering a trailing program rank as a superscript badge:
 * "523 (1)" shows as 523¹. Team-stats cells carry these; most others don't.
 */
export function formatStatCell(raw) {
  const td = document.createElement("td");
  if (raw === null || raw === undefined || raw === "") return td;

  const str = String(raw);
  const match = str.match(/^(.+?)\s*\((\d+)\)$/);
  if (!match) {
    td.textContent = str;
    return td;
  }

  td.appendChild(document.createTextNode(match[1]));
  const rank = document.createElement("sup");
  rank.className = "stat-rank";
  rank.textContent = match[2];
  td.appendChild(rank);
  return td;
}

export function createCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

/** Leading number of a value that may carry a rank suffix, for sorting. */
export function parseNumericValue(str) {
  if (!str) return 0;
  const match = str.toString().match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/** Em dash for the many source cells that have no value. */
export function display(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

// ---------------------------------------------------------------- table search

/**
 * Adds a filter box above a table. `details` is the container; `tableEl` the
 * table to filter (falls back to the first one inside).
 */
export function wrapTableWithSearch(details, tableEl) {
  const table = tableEl || details.querySelector("table");
  if (!table) return details;

  const scrollContainer = details.querySelector(".table-scroll");

  const searchContainer = document.createElement("div");
  searchContainer.className = "table-search-container";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "table-search-input";
  input.placeholder = "Search…";
  input.setAttribute("aria-label", "Search this table");

  const resultCount = document.createElement("span");
  resultCount.className = "search-result-count";
  resultCount.setAttribute("role", "status");

  searchContainer.appendChild(input);
  searchContainer.appendChild(resultCount);

  if (scrollContainer) {
    scrollContainer.parentNode.insertBefore(searchContainer, scrollContainer);
  } else {
    details.insertBefore(searchContainer, table);
  }

  function updateSearch() {
    const query = input.value.toLowerCase();
    const tbody = table.querySelector("tbody");
    let visibleCount = 0;

    if (tbody) {
      tbody.querySelectorAll("tr").forEach((row) => {
        const isMatch = query === "" || row.textContent.toLowerCase().includes(query);
        row.style.display = isMatch ? "" : "none";
        if (isMatch) visibleCount++;
      });
    }

    const total = tbody ? tbody.querySelectorAll("tr").length : 0;
    resultCount.textContent = query ? `${visibleCount} of ${total} results` : "";
  }

  input.addEventListener("input", updateSearch);
  return details;
}

// ----------------------------------------------------------------- data tables

/**
 * Builds a scrollable, searchable table.
 *
 * @param {{label: string, key: string, format?: (row) => string, rank?: boolean}[]} columns
 * @param {object[]} rows
 * @param {{search?: boolean}} [options] search defaults to on above 12 rows.
 */
export function buildRecordTable(columns, rows, options = {}) {
  const container = document.createElement("div");
  container.className = "record-table-block";

  const scroll = document.createElement("div");
  scroll.className = "table-scroll";

  const table = document.createElement("table");
  table.className = "records-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    th.textContent = col.label;
    th.scope = "col";
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const col of columns) {
      const value = col.format ? col.format(row) : row[col.key];
      // Only team-stats-style cells carry a "(N)" rank worth marking up.
      tr.appendChild(col.rank ? formatStatCell(value) : createCell(display(value)));
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  scroll.appendChild(table);
  container.appendChild(scroll);

  const wantSearch = options.search ?? rows.length > 12;
  return wantSearch ? wrapTableWithSearch(container, table) : container;
}

// ----------------------------------------------------------------------- modal

let overlay = null;
let content = null;
let trigger = null;

function trapFocus(e) {
  const focusable = content.querySelectorAll(
    'button, a[href], input, summary, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function ensureModalBuilt() {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.className = "records-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Records");

  content = document.createElement("div");
  content.className = "records-modal-content";

  const closeBtn = document.createElement("button");
  closeBtn.className = "records-modal-close";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.onclick = closeRecordsModal;
  content.appendChild(closeBtn);

  const contentArea = document.createElement("div");
  contentArea.className = "records-modal-inner";
  content.appendChild(contentArea);

  overlay.appendChild(content);
  overlay.onclick = (e) => {
    if (e.target === overlay) closeRecordsModal();
  };

  document.body.appendChild(overlay);

  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") closeRecordsModal();
    if (e.key === "Tab") trapFocus(e);
  });
}

export function openRecordsModal(title, contentElement) {
  ensureModalBuilt();
  trigger = document.activeElement;

  const inner = content.querySelector(".records-modal-inner");
  inner.innerHTML = "";

  const heading = document.createElement("h2");
  heading.textContent = title;
  heading.className = "records-modal-title";
  inner.appendChild(heading);
  inner.appendChild(contentElement);

  overlay.setAttribute("aria-label", title);
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  content.querySelector(".records-modal-close").focus();
}

export function closeRecordsModal() {
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  // Return focus to whatever opened the modal.
  if (trigger && document.contains(trigger)) trigger.focus();
  trigger = null;
}

// ----------------------------------------------------------- leaderboard card

/**
 * A top-N card with a "View all" link that opens the full table in the modal.
 *
 * @param {string} title
 * @param {{name: string, value: string|number}[]} items
 * @param {() => Element} buildFullView called lazily when "View all" is clicked
 * @param {{limit?: number, empty?: string}} [options]
 */
export function renderLeaderboardCard(title, items, buildFullView, options = {}) {
  const limit = options.limit ?? 5;

  const card = document.createElement("div");
  card.className = "leaderboard-card";

  const titleEl = document.createElement("h3");
  titleEl.textContent = title;
  card.appendChild(titleEl);

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = options.empty || "No records yet.";
    card.appendChild(empty);
    return card;
  }

  const listEl = document.createElement("ol");
  listEl.className = "leaderboard-list";
  for (const item of items.slice(0, limit)) {
    const li = document.createElement("li");
    li.className = "leaderboard-item";

    const nameEl = document.createElement("span");
    nameEl.className = "player";
    nameEl.textContent = item.name;

    const valueEl = document.createElement("span");
    valueEl.className = "value";
    valueEl.textContent = item.value;

    li.append(nameEl, " ", valueEl);
    listEl.appendChild(li);
  }
  card.appendChild(listEl);

  if (buildFullView) {
    const link = document.createElement("a");
    link.className = "leaderboard-link";
    link.href = "#";
    link.textContent = "View all";
    link.onclick = (e) => {
      e.preventDefault();
      openRecordsModal(title, buildFullView());
    };
    card.appendChild(link);
  }

  return card;
}

/**
 * Sorts a copy of `rows` by `key` descending and keeps the top `limit`.
 * Values may carry a rank suffix, so comparison goes through parseNumericValue.
 */
export function topBy(rows, key, limit = 10) {
  return rows
    .filter((r) => r[key] !== null && r[key] !== undefined && r[key] !== "")
    .sort((a, b) => parseNumericValue(b[key]) - parseNumericValue(a[key]))
    .slice(0, limit);
}
