import { createLikeButton } from "./likes.js";

let photos = [];
let index = 0;
let lastFocused = null;
// Supplied by the caller so the viewer can describe the photo (opponent, week)
// rather than just its position. Defaults to the position-only form for any
// caller that doesn't pass one.
let describe = (i, total) => `Photo ${i + 1} of ${total}`;

let overlay, figure, track, downloadLink, counterEl, closeBtn, likeSlot, liveEl;

// The three recycled slide elements, ordered by the slot they occupy on
// screen: [offscreen left, visible, offscreen right].
let slides = [];

// The viewer keeps one like button in the chrome rather than one per slide, so
// there is a single subscription to tear down.
let releaseLike = null;

let animating = false;
let gesture = null;
let announceTimer = null;
let pageScrollY = 0;
// A finished drag fires a synthetic click, which would otherwise land on the
// backdrop handler and close the viewer the moment you let go.
let swallowClick = false;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Blank space between slides while a drag is in flight, so the neighbour reads
// as a separate photo rather than a seam.
const SLIDE_GAP = 16;
const SLIDE_MS = 260;
const EASE = "cubic-bezier(.22, .61, .36, 1)";

// Past 8px the drag has committed to an axis; past 22% of the width, or a
// flick faster than this, it has committed to a photo.
const AXIS_LOCK_PX = 8;
const COMMIT_RATIO = 0.22;
const FLING_SPEED = 0.45;
const DISMISS_PX = 110;

// Photos uploaded before the resized "view" variant existed only have a
// full-resolution original, so fall back to it rather than 404ing.
function displayUrl(photo) {
  return photo.viewUrl || photo.fullUrl;
}

function wrap(i) {
  return (i + photos.length) % photos.length;
}

// How far the track travels to move on by one photo.
function stepPx() {
  return figure.clientWidth + SLIDE_GAP;
}

// Reduced motion isn't just a shorter animation here: the global stylesheet
// rule forces every transition to 0.01ms with !important, which beats our
// inline duration. Waiting on transitionend would then block input for the
// full 260ms after the move had already finished.
function slideMs() {
  return reduceMotion.matches ? 0 : SLIDE_MS;
}

function ensureBuilt() {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Photo viewer");
  // The counter is decorative for assistive tech - "3 / 214" says nothing
  // useful - so the live region carries the real description instead.
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Close">&times;</button>
    <div class="lightbox-figure">
      <div class="lightbox-track">
        ${slideMarkup()}${slideMarkup()}${slideMarkup()}
      </div>
    </div>
    <button class="lightbox-nav" data-dir="-1" aria-label="Previous photo">&#8249;</button>
    <span class="lightbox-counter" aria-hidden="true"></span>
    <button class="lightbox-nav" data-dir="1" aria-label="Next photo">&#8250;</button>
    <span class="lightbox-like"></span>
    <a class="btn btn-gold lightbox-download" download>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1.5v8m0 0-3-3m3 3 3-3M2.5 11.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Download
    </a>
    <p class="sr-only" aria-live="polite" aria-atomic="true"></p>
  `;
  document.body.appendChild(overlay);

  figure = overlay.querySelector(".lightbox-figure");
  track = overlay.querySelector(".lightbox-track");
  slides = Array.from(overlay.querySelectorAll(".lb-slide"));
  downloadLink = overlay.querySelector(".lightbox-download");
  counterEl = overlay.querySelector(".lightbox-counter");
  closeBtn = overlay.querySelector(".lightbox-close");
  likeSlot = overlay.querySelector(".lightbox-like");
  liveEl = overlay.querySelector("[aria-live]");

  closeBtn.addEventListener("click", close);

  overlay.addEventListener("click", (e) => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    // Tapping the photo does nothing; the letterbox beside it closes, which is
    // what the old `e.target === overlay` test was reaching for. It almost
    // never matched, because the figure covers nearly the whole screen.
    if (!e.target.closest("button, a, img")) close();
  });

  overlay.querySelectorAll(".lightbox-nav").forEach((btn) => {
    btn.addEventListener("click", () => commit(parseInt(btn.dataset.dir, 10)));
  });

  bindGestures();

  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") commit(-1);
    if (e.key === "ArrowRight") commit(1);
    if (e.key === "Tab") trapFocus(e);
  });

  // The slot offsets are measured in pixels, so they have to be recomputed
  // whenever the viewport changes shape.
  const resync = () => {
    if (!overlay.classList.contains("open") || animating || gesture) return;
    setTrackX(0, false);
    applySlotTransforms();
  };
  window.addEventListener("resize", resync);
  window.visualViewport?.addEventListener("resize", resync);
}

function slideMarkup() {
  return `
    <figure class="lb-slide">
      <img class="lb-thumb" alt="" aria-hidden="true" decoding="async">
      <img class="lb-full" alt="" decoding="async">
      <span class="lb-spinner" aria-hidden="true"></span>
    </figure>
  `;
}

// Keeps Tab inside the dialog while it's open, so keyboard users don't
// wander into the page behind it. Correct only because the slides hold no
// focusable elements - keep it that way.
function trapFocus(e) {
  const focusable = overlay.querySelectorAll("button, a[href]");
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

// `offset` is relative to the current index, so -1/0/+1 are the three slots.
function renderSlide(el, offset) {
  const i = wrap(index + offset);
  const photo = photos[i];
  const thumb = el.querySelector(".lb-thumb");
  const full = el.querySelector(".lb-full");

  clearTimeout(el._spinTimer);
  el.classList.remove("is-loaded", "is-slow");

  thumb.src = photo.thumbUrl;
  full.alt = describe(i, photos.length);
  full.onload = () => {
    clearTimeout(el._spinTimer);
    el.classList.add("is-loaded");
  };
  full.src = displayUrl(photo);

  if (full.complete && full.naturalWidth) full.onload();
  else el._spinTimer = setTimeout(() => el.classList.add("is-slow"), 300);
}

function applySlotTransforms() {
  const step = stepPx();
  slides.forEach((el, slot) => {
    el.style.transform = `translate3d(${(slot - 1) * step}px, 0, 0)`;
    const current = slot === 1;
    // inert implies aria-hidden, so the offscreen photos' alt text stays out
    // of the accessibility tree as well as out of the tab order.
    if (current) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  });
}

function setTrackX(px, animate) {
  track.style.transition = animate ? `transform ${slideMs()}ms ${EASE}` : "none";
  track.style.transform = `translate3d(${px}px, 0, 0)`;
}

function commit(dir) {
  if (animating || photos.length < 2) return;
  animating = true;

  if (slideMs() === 0) {
    requestAnimationFrame(() => settle(dir));
    return;
  }

  setTrackX(-dir * stepPx(), true);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(fallback);
    track.removeEventListener("transitionend", finish);
    settle(dir);
  };
  // transitionend doesn't fire if the transition is interrupted or the tab is
  // backgrounded mid-slide, and a stuck `animating` flag would freeze the
  // viewer for good.
  const fallback = setTimeout(finish, slideMs() + 90);
  track.addEventListener("transitionend", finish);
}

function settle(dir) {
  index = wrap(index + dir);

  // Rotate the slots so the element that just left the far edge is the one
  // re-pointed at a new photo, off screen where its load can't be seen. Every
  // surviving slide moves by exactly as much as the track moves back, in the
  // same frame, so nothing visibly shifts.
  if (dir === 1) slides.push(slides.shift());
  else slides.unshift(slides.pop());
  renderSlide(slides[dir === 1 ? 2 : 0], dir === 1 ? 1 : -1);

  // The neutral transform and `transition: none` have to land together, then
  // be flushed, or the next commit animates this reset backwards first.
  setTrackX(0, false);
  applySlotTransforms();
  void track.offsetWidth;

  animating = false;
  updateChrome();
  preload(dir);
}

function updateChrome() {
  const photo = photos[index];
  downloadLink.href = photo.fullUrl;
  downloadLink.setAttribute("download", photo.name);
  counterEl.textContent = `${index + 1} / ${photos.length}`;

  const hadFocus = likeSlot.contains(document.activeElement);
  releaseLike?.();
  releaseLike = null;
  likeSlot.innerHTML = "";
  if (photo.key) {
    const { element, destroy } = createLikeButton(photo.key);
    likeSlot.appendChild(element);
    releaseLike = destroy;
    if (hadFocus) element.focus();
  }

  // Debounced, so flicking through ten photos queues one announcement rather
  // than ten.
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    liveEl.textContent = describe(index, photos.length);
  }, 400);
}

function onSlowConnection() {
  const c = navigator.connection;
  return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType || ""));
}

// Warms the neighbours so arrow/swipe navigation doesn't wait on a cold fetch.
// Reaches two out either way plus a third in the direction of travel, because
// a flick can commit three photos before the first has finished loading.
function preload(dir = 1) {
  if (photos.length < 2) return;
  const offsets = [1, -1, 2, -2];
  if (!onSlowConnection()) offsets.push(dir === -1 ? -3 : 3);
  for (const offset of offsets) {
    new Image().src = displayUrl(photos[wrap(index + offset)]);
  }
}

function bindGestures() {
  overlay.addEventListener("touchstart", (e) => {
    gesture = null;
    if (animating || e.touches.length !== 1 || isZoomed()) return;
    if (e.target.closest("button, a")) return;

    const t = e.touches[0];
    gesture = {
      id: t.identifier,
      x0: t.clientX,
      y0: t.clientY,
      dx: 0,
      dy: 0,
      axis: null,
      lastX: t.clientX,
      lastY: t.clientY,
      lastT: performance.now(),
      vx: 0,
      vy: 0,
      raf: 0,
    };
  }, { passive: true });

  // Not passive: without preventDefault iOS claims the drag as an overscroll
  // and fires touchcancel partway through, parking the track mid-swipe.
  overlay.addEventListener("touchmove", (e) => {
    if (!gesture) return;
    // Re-checked every move rather than only at touchstart. A second finger
    // landing mid-drag used to leave the start point set, so the pinch ended
    // by flipping the photo; and once zoomed, panning sideways to see the rest
    // of the shot threw the zoom away.
    if (e.touches.length !== 1 || isZoomed()) return abortGesture();

    const t = Array.from(e.touches).find((p) => p.identifier === gesture.id);
    if (!t) return abortGesture();

    gesture.dx = t.clientX - gesture.x0;
    gesture.dy = t.clientY - gesture.y0;

    if (gesture.axis === null) {
      const ax = Math.abs(gesture.dx);
      const ay = Math.abs(gesture.dy);
      if (Math.max(ax, ay) < AXIS_LOCK_PX) return;
      // Decided once and held for the rest of the gesture, so a sideways drag
      // stays a photo change even if the finger wanders. Upward drags are
      // nobody's: only down dismisses.
      gesture.axis = ax > ay * 1.2 ? "x" : gesture.dy > 0 ? "y" : "none";
    }
    if (gesture.axis === "none") return;

    e.preventDefault();
    swallowClick = true;

    const now = performance.now();
    const dt = now - gesture.lastT;
    if (dt > 16) {
      gesture.vx = (t.clientX - gesture.lastX) / dt;
      gesture.vy = (t.clientY - gesture.lastY) / dt;
      gesture.lastX = t.clientX;
      gesture.lastY = t.clientY;
      gesture.lastT = now;
    }

    if (!gesture.raf) gesture.raf = requestAnimationFrame(paintGesture);
  }, { passive: false });

  overlay.addEventListener("touchend", () => {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    if (g.raf) cancelAnimationFrame(g.raf);
    if (g.axis) setTimeout(() => { swallowClick = false; }, 350);

    if (g.axis === "x") {
      const far = Math.abs(g.dx) > figure.clientWidth * COMMIT_RATIO;
      const flick =
        Math.abs(g.vx) > FLING_SPEED &&
        Math.abs(g.dx) > 24 &&
        Math.sign(g.vx) === Math.sign(g.dx);
      if (far || flick) commit(g.dx < 0 ? 1 : -1);
      else setTrackX(0, true);
    } else if (g.axis === "y") {
      if (g.dy > DISMISS_PX || g.vy > 0.5) dismiss();
      else springBack();
    }
  }, { passive: true });

  overlay.addEventListener("touchcancel", abortGesture, { passive: true });
}

function isZoomed() {
  return !!window.visualViewport && window.visualViewport.scale > 1.01;
}

function paintGesture() {
  if (!gesture) return;
  gesture.raf = 0;

  if (gesture.axis === "x") {
    setTrackX(gesture.dx, false);
    return;
  }

  // Dragging down shrinks the photo toward the page it came from and thins the
  // scrim. The blur radius stays put - animating backdrop-filter is expensive
  // and stutters on exactly the phones this is for.
  const progress = Math.min(gesture.dy / 320, 1);
  figure.style.transform = `translate3d(0, ${gesture.dy}px, 0) scale(${1 - progress * 0.14})`;
  overlay.style.setProperty("--lb-chrome", String(Math.max(0, 1 - progress * 2.5)));
  overlay.style.backgroundColor = `rgba(10, 12, 16, ${0.72 - progress * 0.45})`;
}

function abortGesture() {
  if (!gesture) return;
  const g = gesture;
  gesture = null;
  if (g.raf) cancelAnimationFrame(g.raf);
  // A cancelled drag usually means no click is coming, so the swallow has to
  // time out on its own or it eats the next real tap.
  if (g.axis) setTimeout(() => { swallowClick = false; }, 350);
  if (g.axis === "x") setTrackX(0, true);
  else if (g.axis === "y") springBack();
}

function springBack() {
  figure.classList.add("is-settling");
  figure.style.transform = "";
  overlay.style.removeProperty("--lb-chrome");
  overlay.style.backgroundColor = "";
  setTimeout(() => figure.classList.remove("is-settling"), 240);
}

function dismiss() {
  if (slideMs() === 0) {
    close();
    return;
  }
  figure.classList.add("is-settling");
  figure.style.transform = "translate3d(0, 55vh, 0) scale(0.82)";
  figure.style.opacity = "0";
  overlay.style.setProperty("--lb-chrome", "0");
  overlay.style.backgroundColor = "rgba(10, 12, 16, 0)";
  setTimeout(close, 200);
}

// The plain `overflow: hidden` form doesn't stop iOS rubber-banding the page
// behind the viewer, so the scroll position is parked and restored instead.
function lockScroll() {
  pageScrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${pageScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.overflow = "hidden";
}

function unlockScroll() {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.overflow = "";
  window.scrollTo(0, pageScrollY);
}

export function openLightbox(photoList, startIndex, describeFn) {
  ensureBuilt();
  lastFocused = document.activeElement;
  photos = photoList;
  index = startIndex;
  describe = describeFn || ((i, total) => `Photo ${i + 1} of ${total}`);

  // The slots are measured from the figure's width, so the overlay has to be
  // laid out before they can be placed.
  overlay.classList.add("open");
  lockScroll();

  slides.forEach((el, slot) => renderSlide(el, slot - 1));
  setTrackX(0, false);
  applySlotTransforms();
  updateChrome();
  preload();
  closeBtn.focus();
}

function close() {
  releaseLike?.();
  releaseLike = null;
  clearTimeout(announceTimer);
  liveEl.textContent = "";

  overlay.classList.remove("open");
  figure.classList.remove("is-settling");
  figure.style.transform = "";
  figure.style.opacity = "";
  overlay.style.removeProperty("--lb-chrome");
  overlay.style.backgroundColor = "";
  animating = false;
  gesture = null;

  unlockScroll();
  // Send focus back to the thumbnail that opened the viewer.
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  lastFocused = null;
}
