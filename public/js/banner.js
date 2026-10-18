import { openLightbox } from "./lightbox.js";

// Pixels per second the strip drifts on its own.
const DRIFT_SPEED = 30;
// How long the drift stays paused after someone hovers, touches or uses an arrow.
const RESUME_AFTER_MS = 3000;
const RESUME_AFTER_ARROW_MS = 6000;

// Wires up the old-photos strip: a slow drift that loops, arrows, and plain
// swipe/trackpad scrolling. Safe to call on any page; it's a no-op without the
// #photo-banner markup.
export async function initPhotoBanner() {
  const bannerEl = document.getElementById("photo-banner");
  const scroller = document.getElementById("photo-banner-scroller");
  const trackEl = document.getElementById("photo-banner-track");
  if (!bannerEl || !scroller || !trackEl) return;

  try {
    const res = await fetch("/api/banner");
    if (!res.ok) throw new Error(`banner ${res.status}`);
    const data = await res.json();
    const images = data.images || [];
    // Small tiles for the strip; the viewer opens the full-size file.
    const thumbs = data.thumbs && data.thumbs.length === images.length ? data.thumbs : images;
    if (images.length === 0) {
      bannerEl.hidden = true;
      return;
    }

    // The banner only has one size per photo (no separate view/thumb the way
    // week photos do), so the same URL serves as both the on-screen display
    // and the downloadable file.
    const photos = images.map((src, i) => ({
      name: src.split("/").pop(),
      thumbUrl: thumbs[i],
      viewUrl: src,
      fullUrl: src,
    }));

    // The set goes in twice so the strip can loop: past the halfway point it
    // jumps back by exactly one set, which shows the same photos. The second
    // copy is hidden from keyboards and screen readers so each photo is only
    // met once.
    trackEl.innerHTML = "";
    for (let copy = 0; copy < 2; copy++) {
      for (let photoIndex = 0; photoIndex < images.length; photoIndex++) {
        const btn = document.createElement("button");
        btn.type = "button";
        if (copy === 0) {
          btn.setAttribute("aria-label", `Open photo ${photoIndex + 1} of ${images.length}`);
        } else {
          btn.setAttribute("aria-hidden", "true");
          btn.tabIndex = -1;
        }
        btn.addEventListener("click", () => openLightbox(photos, photoIndex));

        const img = document.createElement("img");
        img.src = thumbs[photoIndex];
        img.loading = "lazy";
        img.fetchPriority = "low";
        img.alt = "";

        btn.appendChild(img);
        trackEl.appendChild(btn);
      }
    }

    bannerEl.hidden = false;
    initMotion(bannerEl, scroller);
  } catch (err) {
    // Decorative only, so hide it on failure rather than showing an error.
    bannerEl.hidden = true;
  }
}

function initMotion(bannerEl, scroller) {
  const half = () => scroller.scrollWidth / 2;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let pos = scroller.scrollLeft;
  let lastSet = Math.round(pos);
  let lastTime = null;
  let pausedUntil = 0;
  let hovering = false;
  let onScreen = true;

  function running() {
    return !reducedMotion && !hovering && onScreen && !document.hidden && performance.now() >= pausedUntil;
  }

  function pauseFor(ms) {
    pausedUntil = performance.now() + ms;
  }

  // Keeps scrollLeft inside the first copy, so the strip never runs out in
  // either direction.
  function wrap() {
    const h = half();
    if (h <= 0) return;
    if (scroller.scrollLeft >= h) scroller.scrollLeft -= h;
    else if (scroller.scrollLeft <= 0) scroller.scrollLeft += h;
  }

  for (const [selector, direction] of [[".archive-arrow.prev", -1], [".archive-arrow.next", 1]]) {
    bannerEl.querySelector(selector)?.addEventListener("click", () => {
      pauseFor(RESUME_AFTER_ARROW_MS);
      const step = scroller.clientWidth * 0.8;
      // Going back from near the start, hop forward one set first (same
      // photos) so there's room to scroll back into.
      if (direction < 0 && scroller.scrollLeft < step) scroller.scrollLeft += half();
      scroller.scrollBy({ left: direction * step, behavior: "smooth" });
    });
  }

  // Wrapping mid-way through a smooth arrow scroll would cut it short, so
  // only wrap once scrolling has settled.
  let settle = null;
  scroller.addEventListener("scroll", () => {
    if (running()) return;
    clearTimeout(settle);
    settle = setTimeout(wrap, 200);
  }, { passive: true });

  if (reducedMotion) return;

  function frame(now) {
    if (lastTime !== null && running()) {
      // Someone scrolled by hand (or an arrow moved it): carry on from there.
      if (Math.abs(scroller.scrollLeft - lastSet) > 2) pos = scroller.scrollLeft;
      pos += (DRIFT_SPEED * (now - lastTime)) / 1000;
      const h = half();
      if (h > 0 && pos >= h) pos -= h;
      // Browsers round scrollLeft, so the fraction lives in `pos`.
      lastSet = Math.round(pos);
      scroller.scrollLeft = lastSet;
    } else {
      pos = scroller.scrollLeft;
      lastSet = Math.round(pos);
    }
    lastTime = now;
    requestAnimationFrame(frame);
  }

  bannerEl.addEventListener("pointerenter", () => { hovering = true; });
  bannerEl.addEventListener("pointerleave", () => { hovering = false; pauseFor(RESUME_AFTER_MS); });
  bannerEl.addEventListener("focusin", () => { hovering = true; });
  bannerEl.addEventListener("focusout", () => { hovering = false; pauseFor(RESUME_AFTER_MS); });
  scroller.addEventListener("touchstart", () => pauseFor(60000), { passive: true });
  scroller.addEventListener("touchend", () => pauseFor(RESUME_AFTER_MS), { passive: true });

  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
  }).observe(scroller);

  requestAnimationFrame(frame);
}
