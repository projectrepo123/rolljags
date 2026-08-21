let photos = [];
let index = 0;
let lastFocused = null;

let overlay, imgEl, downloadLink, counterEl, closeBtn;

// Photos uploaded before the resized "view" variant existed only have a
// full-resolution original, so fall back to it rather than 404ing.
function displayUrl(photo) {
  return photo.viewUrl || photo.fullUrl;
}

function ensureBuilt() {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Photo viewer");
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Close">&times;</button>
    <div class="lightbox-content">
      <div class="lightbox-figure"><img alt="" /></div>
      <div class="lightbox-controls">
        <button class="lightbox-nav" data-dir="-1" aria-label="Previous photo">&#8249;</button>
        <span class="lightbox-counter"></span>
        <button class="lightbox-nav" data-dir="1" aria-label="Next photo">&#8250;</button>
      </div>
      <a class="btn btn-gold lightbox-download" download>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1.5v8m0 0-3-3m3 3 3-3M2.5 11.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Download
      </a>
    </div>
  `;
  document.body.appendChild(overlay);

  imgEl = overlay.querySelector("img");
  downloadLink = overlay.querySelector(".lightbox-download");
  counterEl = overlay.querySelector(".lightbox-counter");
  closeBtn = overlay.querySelector(".lightbox-close");

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelectorAll(".lightbox-nav").forEach((btn) => {
    btn.addEventListener("click", () => step(parseInt(btn.dataset.dir, 10)));
  });

  // Swipe left/right to move between photos, the expected gesture on a phone.
  let touchStartX = null;
  let touchStartY = null;
  overlay.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  overlay.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;
    // Ignore mostly-vertical drags so pinch-zoom panning doesn't flip photos.
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    step(dx < 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
    if (e.key === "Tab") trapFocus(e);
  });
}

// Keeps Tab inside the dialog while it's open, so keyboard users don't
// wander into the page behind it.
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

// Warms the neighbours so arrow/swipe navigation doesn't wait on a cold fetch.
function preloadNeighbours() {
  if (photos.length < 2) return;
  for (const offset of [1, -1]) {
    const neighbour = photos[(index + offset + photos.length) % photos.length];
    new Image().src = displayUrl(neighbour);
  }
}

function render() {
  const photo = photos[index];
  imgEl.src = displayUrl(photo);
  imgEl.alt = `Photo ${index + 1} of ${photos.length}`;
  downloadLink.href = photo.fullUrl;
  downloadLink.setAttribute("download", photo.name);
  counterEl.textContent = `${index + 1} / ${photos.length}`;
  preloadNeighbours();
}

function step(dir) {
  index = (index + dir + photos.length) % photos.length;
  render();
}

export function openLightbox(photoList, startIndex) {
  ensureBuilt();
  lastFocused = document.activeElement;
  photos = photoList;
  index = startIndex;
  render();
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  closeBtn.focus();
}

function close() {
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  // Send focus back to the thumbnail that opened the viewer.
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  lastFocused = null;
}
