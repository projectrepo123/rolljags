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
export async function toggleLike(key) {
  const wasLiked = liked.has(key);
  const previous = getCount(key);

  counts.set(key, Math.max(0, previous + (wasLiked ? -1 : 1)));
  if (wasLiked) liked.delete(key);
  else liked.add(key);
  persistLiked();
  emit(key);

  try {
    const res = await fetch("/api/like", {
      method: wasLiked ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) throw new Error(String(res.status));

    // Trust the server's number once it answers — it accounts for everyone
    // else's taps since the page loaded.
    const data = await res.json();
    if (Number.isFinite(data.count)) {
      counts.set(key, data.count);
      emit(key);
    }
  } catch {
    // Roll back so the tap can be retried rather than silently doing nothing.
    counts.set(key, previous);
    if (wasLiked) liked.add(key);
    else liked.delete(key);
    persistLiked();
    emit(key);
  }
}

// Builds the flame control for the photo viewer. Lives here rather than in
// lightbox.js so the state, the markup, and the accessible naming stay in one
// place if it's ever shown somewhere else again.
export function createLikeButton(key) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "like-btn";

  const flame = document.createElement("span");
  flame.className = "like-flame";
  flame.textContent = "🔥";
  flame.setAttribute("aria-hidden", "true");

  const countEl = document.createElement("span");
  countEl.className = "like-count";

  btn.append(flame, countEl);

  const unsubscribe = onChange(key, (count, isLiked) => {
    btn.classList.toggle("liked", isLiked);
    // A toggle, so aria-pressed rather than a disabled state — the button
    // stays focusable and screen readers announce both that it's on and how
    // to turn it back off.
    btn.setAttribute("aria-pressed", String(isLiked));
    // Zero shows no number at all.
    countEl.textContent = count > 0 ? String(count) : "";
    btn.setAttribute(
      "aria-label",
      count > 0
        ? `Like this photo, ${count} ${count === 1 ? "like" : "likes"}`
        : "Like this photo",
    );
  });

  btn.addEventListener("click", (event) => {
    event.preventDefault();

    // Only animate on the way in; popping while taking a like back reads as
    // celebrating the wrong thing.
    if (!hasLiked(key)) {
      btn.classList.remove("pop");
      // Forces a reflow so the animation restarts if it's mid-flight.
      void btn.offsetWidth;
      btn.classList.add("pop");
    }
    toggleLike(key);
  });

  btn.addEventListener("animationend", () => btn.classList.remove("pop"));

  return { element: btn, destroy: unsubscribe };
}
