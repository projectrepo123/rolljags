// Shared like state for a week's photos. The grid and the lightbox both read
// from here, so a photo liked in one is instantly liked in the other rather
// than each keeping its own copy and drifting.

const STORAGE_KEY = "rolljags:liked";

// key -> count, for photos with at least one like. A key that's absent has
// zero, which the UI renders as nothing at all.
const counts = new Map();

// key -> Set of callbacks, so a photo showing in two places updates in both.
const listeners = new Map();

// Read once at startup. Every access is wrapped because Safari in private
// mode throws on localStorage rather than returning null.
const liked = loadLiked();

function loadLiked() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistLiked() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...liked]));
  } catch {
    // Storage full or blocked. The like still counts on the server; this
    // visitor just won't be stopped from liking it again next visit.
  }
}

export function hasLiked(key) {
  return liked.has(key);
}

export function getCount(key) {
  return counts.get(key) || 0;
}

// Registers a render callback for one photo and fires it immediately, so a
// caller doesn't have to paint the initial state itself. Returns an
// unsubscribe function.
export function onChange(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  callback(getCount(key), hasLiked(key));
  return () => listeners.get(key)?.delete(callback);
}

function emit(key) {
  for (const callback of listeners.get(key) || []) {
    callback(getCount(key), hasLiked(key));
  }
}

export async function loadCounts(year, week) {
  try {
    const res = await fetch(`/api/likes?year=${encodeURIComponent(year)}&week=${encodeURIComponent(week)}`);
    if (!res.ok) return;

    const data = await res.json();
    for (const [key, count] of Object.entries(data.counts || {})) {
      counts.set(key, count);
      emit(key);
    }
  } catch {
    // Counts are an enhancement. If they don't load, the flames still work
    // and the gallery is unaffected.
  }
}

// Optimistic on purpose, not just for polish: KV is eventually consistent, so
// the count read back straight after a write is often the pre-write value.
// Waiting for the server would make the number appear to jump backwards.
export async function like(key) {
  if (liked.has(key)) return;

  const previous = getCount(key);
  counts.set(key, previous + 1);
  liked.add(key);
  persistLiked();
  emit(key);

  try {
    const res = await fetch("/api/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) throw new Error(String(res.status));

    // Trust the server's number once it answers — it accounts for everyone
    // else's likes since the page loaded.
    const data = await res.json();
    if (Number.isFinite(data.count)) {
      counts.set(key, data.count);
      emit(key);
    }
  } catch {
    // Roll back so the tap can be retried rather than silently doing nothing.
    counts.set(key, previous);
    liked.delete(key);
    persistLiked();
    emit(key);
  }
}

// Builds the flame control. Shared by the grid and the lightbox so the two
// can't drift in markup, behaviour, or accessible naming.
export function createLikeButton(key, { className = "" } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `like-btn${className ? ` ${className}` : ""}`;

  const flame = document.createElement("span");
  flame.className = "like-flame";
  flame.textContent = "🔥";
  flame.setAttribute("aria-hidden", "true");

  const countEl = document.createElement("span");
  countEl.className = "like-count";

  btn.append(flame, countEl);

  const unsubscribe = onChange(key, (count, isLiked) => {
    btn.classList.toggle("liked", isLiked);
    // aria-disabled rather than the disabled property: a disabled button
    // leaves the tab order, which would hide the count from keyboard and
    // screen-reader users and punch a hole in the lightbox's focus trap
    // (it collects "button, a[href]" and calls .focus() on the ends).
    btn.setAttribute("aria-disabled", String(isLiked));
    // Zero shows nothing — an untouched gallery looks exactly as it did
    // before this feature existed.
    countEl.textContent = count > 0 ? String(count) : "";
    btn.setAttribute(
      "aria-label",
      isLiked
        ? `Liked${count > 0 ? `, ${count} ${count === 1 ? "like" : "likes"}` : ""}`
        : "Like this photo",
    );
  });

  btn.addEventListener("click", (event) => {
    // The grid tile behind this button opens the lightbox.
    event.stopPropagation();
    event.preventDefault();

    if (hasLiked(key)) return;
    btn.classList.remove("pop");
    // Forces a reflow so the animation restarts if it's mid-flight.
    void btn.offsetWidth;
    btn.classList.add("pop");
    like(key);
  });

  btn.addEventListener("animationend", () => btn.classList.remove("pop"));

  return { element: btn, destroy: unsubscribe };
}
