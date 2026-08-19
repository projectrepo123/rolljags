// Mobile nav disclosure. The links are always in the DOM; on small screens
// CSS collapses them and this toggles them back open.
(function initNav() {
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  function setOpen(open) {
    links.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("open", open);
  }

  function isOpen() {
    return toggle.getAttribute("aria-expanded") === "true";
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!isOpen());
  });

  // Tapping anywhere else on the page dismisses the menu.
  document.addEventListener("click", (e) => {
    if (isOpen() && !links.contains(e.target) && e.target !== toggle) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Following a link navigates away, but reset state for same-page anchors
  // and for browsers restoring the page from bfcache.
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") setOpen(false);
  });

  // If the viewport grows past the mobile breakpoint the links are visible
  // again via CSS, so drop the open state to keep aria-expanded honest.
  const wide = window.matchMedia("(min-width: 481px)");
  wide.addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
  });
})();
