let photos = [];
let index = 0;

let overlay, imgEl, downloadLink, counterEl;

function ensureBuilt() {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Close">&times;</button>
    <div class="lightbox-content">
      <img alt="" />
      <div class="lightbox-controls">
        <button class="lightbox-nav" data-dir="-1" aria-label="Previous">&#8249;</button>
        <span class="lightbox-counter"></span>
        <button class="lightbox-nav" data-dir="1" aria-label="Next">&#8250;</button>
      </div>
      <a class="btn btn-gold lightbox-download" download>Download</a>
    </div>
  `;
  document.body.appendChild(overlay);

  imgEl = overlay.querySelector("img");
  downloadLink = overlay.querySelector(".lightbox-download");
  counterEl = overlay.querySelector(".lightbox-counter");

  overlay.querySelector(".lightbox-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelectorAll(".lightbox-nav").forEach((btn) => {
    btn.addEventListener("click", () => step(parseInt(btn.dataset.dir, 10)));
  });

  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
}

function render() {
  const photo = photos[index];
  imgEl.src = photo.fullUrl;
  imgEl.alt = photo.name;
  downloadLink.href = photo.fullUrl;
  downloadLink.setAttribute("download", photo.name);
  counterEl.textContent = `${index + 1} / ${photos.length}`;
}

function step(dir) {
  index = (index + dir + photos.length) % photos.length;
  render();
}

export function openLightbox(photoList, startIndex) {
  ensureBuilt();
  photos = photoList;
  index = startIndex;
  render();
  overlay.classList.add("open");
}

function close() {
  overlay.classList.remove("open");
}
