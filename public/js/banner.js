import { openLightbox } from "./lightbox.js";

// Wires up the old-photos strip, a row people scroll through themselves.
// Safe to call on any page; it's a no-op without the #photo-banner markup.
export async function initPhotoBanner() {
  const bannerEl = document.getElementById("photo-banner");
  const trackEl = document.getElementById("photo-banner-track");
  if (!bannerEl || !trackEl) return;

  try {
    const res = await fetch("/api/banner");
    if (!res.ok) throw new Error(`banner ${res.status}`);
    const data = await res.json();
    const images = data.images || [];
    if (images.length === 0) {
      bannerEl.hidden = true;
      return;
    }

    // The banner only has one size per photo (no separate view/thumb the way
    // week photos do), so the same URL serves as both the on-screen display
    // and the downloadable file.
    const photos = images.map((src) => ({
      name: src.split("/").pop(),
      thumbUrl: src,
      viewUrl: src,
      fullUrl: src,
    }));

    trackEl.innerHTML = "";
    for (let photoIndex = 0; photoIndex < images.length; photoIndex++) {
      const btn = document.createElement("button");
      btn.setAttribute("aria-label", `Open photo ${photoIndex + 1} of ${images.length}`);
      btn.addEventListener("click", () => openLightbox(photos, photoIndex));

      const img = document.createElement("img");
      img.src = images[photoIndex];
      img.loading = "lazy";
      img.fetchPriority = "low";
      img.alt = "";

      btn.appendChild(img);
      trackEl.appendChild(btn);
    }

    bannerEl.hidden = false;
  } catch (err) {
    // Decorative only, so hide it on failure rather than showing an error.
    bannerEl.hidden = true;
  }
}
