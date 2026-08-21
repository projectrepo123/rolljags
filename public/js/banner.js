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

    // The strip scrolls continuously; duplicating the set once lets the
    // animation loop from -50% back to 0% without a visible seam.
    const tiles = [...images, ...images];
    trackEl.innerHTML = "";
    for (const src of tiles) {
      const img = document.createElement("img");
      img.src = src;
      img.loading = "lazy";
      img.alt = "";
      trackEl.appendChild(img);
    }

    trackEl.style.animationDuration = `${images.length * SECONDS_PER_PHOTO}s`;

    // Touch devices have no hover, so tapping a photo toggles the same
    // zoomed-in look (and pauses the scroll) instead. Tapping it again, or a
    // different photo, clears it.
    trackEl.addEventListener("click", (e) => {
      const img = e.target.closest("img");
      if (!img) return;
      const alreadyZoomed = img.classList.contains("zoomed");
      trackEl.querySelectorAll("img.zoomed").forEach((el) => el.classList.remove("zoomed"));
      img.classList.toggle("zoomed", !alreadyZoomed);
      trackEl.classList.toggle("has-zoom", !alreadyZoomed);
    });

    bannerEl.hidden = false;
  } catch (err) {
    // Decorative only — leave it hidden on failure rather than showing an error.
  }
}
