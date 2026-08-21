import { openLightbox } from "./lightbox.js";

// Keeps per-photo scroll speed constant regardless of how many photos are in
// the set, so adding more later doesn't speed up the loop.
const SECONDS_PER_PHOTO = 6;

// Wires up the rotating old-photos strip. Safe to call on any page — it's a
// no-op if that page doesn't have the #photo-banner markup.
export async function initPhotoBanner() {
  const bannerEl = document.getElementById("photo-banner");
  const trackEl = document.getElementById("photo-banner-track");
  if (!bannerEl || !trackEl) return;

  try {
    const res = await fetch("/api/banner");
    if (!res.ok) throw new Error(`banner ${res.status}`);
    const data = await res.json();
    const images = data.images || [];
    if (images.length === 0) return;

    // The banner only has one size per photo (no separate view/thumb the way
    // week photos do), so the same URL serves as both the on-screen display
    // and the downloadable file.
    const photos = images.map((src) => ({
      name: src.split("/").pop(),
      thumbUrl: src,
      viewUrl: src,
      fullUrl: src,
    }));

    // The strip scrolls continuously; duplicating the tiles once lets the
    // animation loop from -50% back to 0% without a visible seam. Each tile
    // still opens the lightbox on the underlying (non-duplicated) photo list,
    // so prev/next navigation inside it cycles through the real set of photos.
    trackEl.innerHTML = "";
    for (let i = 0; i < images.length * 2; i++) {
      const photoIndex = i % images.length;

      const btn = document.createElement("button");
      btn.setAttribute("aria-label", `Open photo ${photoIndex + 1} of ${images.length}`);
      btn.addEventListener("click", () => openLightbox(photos, photoIndex));

      const img = document.createElement("img");
      img.src = images[photoIndex];
      img.loading = "lazy";
      img.alt = "";

      btn.appendChild(img);
      trackEl.appendChild(btn);
    }

    trackEl.style.animationDuration = `${images.length * SECONDS_PER_PHOTO}s`;

    bannerEl.hidden = false;
  } catch (err) {
    // Decorative only — leave it hidden on failure rather than showing an error.
  }
}
